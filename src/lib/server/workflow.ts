import "server-only";
import { randomBytes, createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { admin } from "./supabase";
import { databaseError, ownedSession } from "./sessions";
import { monthlyVoiceMinutes, voiceConfig, reasoningConfig } from "./config";
import { scoreTranscript } from "./scoring";
import { AppError } from "./http";
import { transcriptReady, type Transcript } from "../domain/samvaad";
import { sessionSchema } from "../product-contracts";
import { practiceModeSchema } from "../domain/practice-mode";
import { SPEECH_PROTOCOL, speechGrantSchema } from "../voice/protocol";
import { gatewayReady } from "./gateway-readiness";

export async function operation(name: string, args: Record<string, unknown>) {
  const { data, error } = await admin().schema("samvaad").rpc(name, args);
  databaseError(error);
  return data;
}

export async function openVoice(owner: string, id: string) {
  const session = sessionSchema.parse(await ownedSession(owner, id));
  const config = voiceConfig(session.durationSeconds, session.mode);
  // Check scoring configuration before reserving a paid call.
  reasoningConfig();
  if (
    process.env.VOICE_GATEWAY_WARMUP_ENABLED === "true" &&
    !(await gatewayReady(config.websocketUrl))
  )
    throw new AppError("VOICE_WARMING", 503, true);
  const grant = randomBytes(32).toString("base64url");
  const result = z
    .object({ runId: z.uuid(), expiresAt: z.iso.datetime({ offset: true }) })
    .parse(
      await operation("reserve_speech", {
        p_user: owner,
        p_session: id,
        p_hash: createHash("sha256").update(grant).digest("hex"),
        p_minutes: monthlyVoiceMinutes(),
      }),
    );
  return speechGrantSchema.parse({
    ...result,
    grant,
    websocketUrl: config.websocketUrl,
    protocol: SPEECH_PROTOCOL,
  });
}

export async function requestCompletion(owner: string, id: string) {
  await operation("request_speech_completion", {
    p_user: owner,
    p_session: id,
  });
  return ownedSession(owner, id);
}

const workSchema = z.object({
  id: z.uuid(),
  transcript: sessionSchema.shape.transcript,
  scoreAttempts: z.number().int().min(0).max(2),
  mode: practiceModeSchema,
  topic: z.string().min(1).max(240),
});

export async function processSession(id: string) {
  const token = randomUUID();
  const claimed = await operation("claim_speech_work", {
    p_session: id,
    p_token: token,
  });
  if (!claimed) return;
  const work = workSchema.parse(claimed);
  const advance = async (action: string, data: unknown = {}) =>
    operation("advance_work", {
      p_session: id,
      p_token: token,
      p_action: action,
      p_data: data,
    });
  try {
    const transcript: Transcript | null = work.transcript;
    if (!transcript || !transcriptReady(transcript)) {
      await advance("fail", { code: "TRANSCRIPT_UNAVAILABLE" });
      return;
    }
    reasoningConfig();
    // Attempts are persisted before the external request, including timeouts/crashes.
    // A reclaimed lease therefore cannot accidentally create an unlimited retry loop.
    for (let attempt = work.scoreAttempts; attempt < 2; attempt++) {
      if ((await advance("score_attempt")) !== true) return;
      let score;
      try {
        score = await scoreTranscript(transcript, work.mode, work.topic);
      } catch {
        if (attempt === 1) {
          await advance("fail", { code: "SCORING_FAILED" });
          return;
        }
        continue;
      }
      await advance("complete", score);
      return;
    }
    await advance("fail", { code: "SCORING_FAILED" });
  } catch (error) {
    if (error instanceof AppError && error.code === "EXECUTION_MISMATCH") {
      await advance("fail", { code: "EXECUTION_MISMATCH" });
    } else {
      // Retryable work remains durable and gets a new lease on a later tick.
      await advance("retry");
      console.warn(
        JSON.stringify({
          event: "session_processing_deferred",
          code: error instanceof AppError ? error.code : "INTERNAL_ERROR",
        }),
      );
    }
  }
}

export async function recoverDueSessions() {
  const db = admin().schema("samvaad");
  const expiry = await db
    .from("sessions")
    .update({
      status: "expired",
      error_code: "SESSION_EXPIRED",
      error_message: "This round expired before it started.",
    })
    .eq("status", "created")
    .lt("created_at", new Date(Date.now() - 1800000).toISOString());
  databaseError(expiry.error);
  const { data, error } = await db
    .from("sessions")
    .select("id")
    .in("status", ["awaiting_voice", "in_progress", "processing"])
    .lte("next_poll_at", new Date().toISOString())
    .or(`work_until.is.null,work_until.lt.${new Date().toISOString()}`)
    .order("next_poll_at")
    .limit(2);
  databaseError(error);
  // Two bounded jobs fit within a 120-second server route; each lease fences stale workers.
  for (const row of z.array(z.object({ id: z.uuid() })).parse(data))
    await processSession(row.id);
  return { checked: data?.length ?? 0 };
}
