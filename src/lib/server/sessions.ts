import "server-only";
import { z } from "zod";
import { admin } from "./supabase";
import { AppError, fail } from "./http";
import { dailySessionLimit, maxSessionDuration, voiceConfig } from "./config";
import { rubricVersion } from "../domain/practice-mode";
import {
  type SamvaadSetup,
  sessionStatusSchema,
  DIMENSION_GUIDE,
  SCORE_DIMENSIONS,
} from "../domain/samvaad";
import {
  historySchema,
  sessionSchema,
  summarySchema,
  topicsSchema,
} from "../product-contracts";

const summaryColumns =
  "id,mode,rubric_version,difficulty,planned_duration_seconds,status,created_at,started_at,completed_at,overall_score,topic:topics(id,title,category,description)";
const detailColumns = `${summaryColumns},transcript,dimension_scores,strongest_moment,weakest_moment,practice_actions,error_message,error_code`;
const rowSchema = z
  .object({
    id: z.uuid(),
    topic: z.unknown(),
    difficulty: z.unknown(),
    planned_duration_seconds: z.number(),
    status: sessionStatusSchema,
    created_at: z.string(),
    started_at: z.string().nullable(),
    completed_at: z.string().nullable(),
    overall_score: z.number().nullable(),
  })
  .passthrough();

export function databaseError(error: { message: string } | null) {
  if (!error) return;
  const statuses: Record<string, number> = {
    VALIDATION_ERROR: 400,
    IDEMPOTENCY_CONFLICT: 409,
    RATE_LIMITED: 429,
    SESSION_NOT_FOUND: 404,
    SESSION_NOT_ACTIVE: 409,
    SESSION_NOT_READY: 409,
    SESSION_EXPIRED: 409,
    SESSION_ALREADY_ACTIVE: 409,
    CAPACITY_LIMIT: 429,
  };
  const status = statuses[error.message];
  if (status) throw new AppError(error.message, status);
  throw new AppError("SERVICE_UNAVAILABLE", 503, true);
}

export function mapSession(value: unknown, detail = true) {
  const row = rowSchema.parse(value);
  const summary = summarySchema.parse({
    mode: row.mode ?? "group_discussion",
    rubricVersion: row.rubric_version ?? rubricVersion("group_discussion"),
    id: row.id,
    topic: row.topic,
    difficulty: row.difficulty,
    durationSeconds: row.planned_duration_seconds,
    status: row.status,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    overallScore: row.status === "completed" ? row.overall_score : null,
  });
  if (!detail) return summary;
  return sessionSchema.parse({
    ...summary,
    transcript: row.transcript ?? null,
    scorecard:
      row.status === "completed"
        ? {
            overallScore: row.overall_score,
            dimensions: row.dimension_scores,
            strongestMoment: row.strongest_moment,
            weakestMoment: row.weakest_moment,
            practiceActions: row.practice_actions,
          }
        : null,
    error: row.error_message
      ? {
          code:
            typeof row.error_code === "string"
              ? row.error_code
              : "SESSION_FAILED",
          message:
            row.status === "expired"
              ? "This round timed out. Please start a new round."
              : row.error_code === "TRANSCRIPT_UNAVAILABLE"
                ? "There was not enough verified conversation for feedback. Please try a new round."
                : row.error_code === "SCORING_FAILED"
                  ? "We could not prepare feedback after two attempts. Your transcript is preserved. Please try a new round."
                  : "This round could not be completed. Please start a new round.",
          retryable: false,
        }
      : null,
  });
}

export async function topics() {
  const { data, error } = await admin()
    .schema("samvaad")
    .from("topics")
    .select("id,title,category,description")
    .eq("is_active", true)
    .order("sort_order")
    .limit(5);
  databaseError(error);
  return topicsSchema.parse({ topics: data });
}

export async function ownedSession(owner: string, id: string) {
  const { data, error } = await admin()
    .schema("samvaad")
    .from("sessions")
    .select(detailColumns)
    .eq("user_id", owner)
    .eq("id", id)
    .maybeSingle();
  databaseError(error);
  if (!data) fail("SESSION_NOT_FOUND", 404);
  return mapSession(data);
}

export async function createSession(
  owner: string,
  setup: SamvaadSetup,
  key: string,
) {
  {
    try {
      voiceConfig(setup.durationSeconds, setup.mode);
    } catch {
      fail("SERVICE_UNAVAILABLE", 503);
    }
  }
  const { data, error } = await admin()
    .schema("samvaad")
    .rpc("create_speech_session", {
      p_user: owner,
      p_topic: setup.topicId,
      p_difficulty: setup.difficulty,
      p_duration: setup.durationSeconds,
      p_key: key,
      p_limit: dailySessionLimit(),
      p_max_duration: maxSessionDuration(),
      p_mode: setup.mode ?? "group_discussion",
    });
  databaseError(error);
  return ownedSession(owner, z.uuid().parse(data));
}

const cursorSchema = z
  .object({ at: z.iso.datetime({ offset: true }), id: z.uuid() })
  .strict();
export function parseHistoryQuery(query: URLSearchParams) {
  const limit = z.coerce
    .number()
    .int()
    .min(1)
    .max(50)
    .parse(query.get("limit") ?? 20);
  const status = query.has("status")
    ? sessionStatusSchema.parse(query.get("status"))
    : undefined;
  let cursor: z.infer<typeof cursorSchema> | undefined;
  if (query.has("cursor")) {
    try {
      const raw = z.string().min(1).max(500).parse(query.get("cursor"));
      cursor = cursorSchema.parse(
        JSON.parse(Buffer.from(raw, "base64url").toString("utf8")),
      );
    } catch {
      fail("VALIDATION_ERROR", 400);
    }
  }
  return { limit, status, cursor };
}

export async function history(owner: string, query: URLSearchParams) {
  const { limit, status, cursor } = parseHistoryQuery(query);
  const db = admin().schema("samvaad");
  let request = db
    .from("sessions")
    .select(summaryColumns)
    .eq("user_id", owner)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);
  if (status) request = request.eq("status", status);
  if (cursor)
    request = request.or(
      `created_at.lt.${cursor.at},and(created_at.eq.${cursor.at},id.lt.${cursor.id})`,
    );
  const [page, stats] = await Promise.all([
    request,
    db.rpc("history_stats", { p_user: owner }),
  ]);
  databaseError(page.error);
  databaseError(stats.error);
  const parsedStats = historySchema.shape.stats.parse(stats.data);
  const dimension = SCORE_DIMENSIONS.find(
    (value) => value === parsedStats.focus,
  );
  if (dimension) parsedStats.focus = DIMENSION_GUIDE[dimension].label;
  const rows = (page.data ?? []).map((row) => mapSession(row, false));
  const sessions = rows.slice(0, limit);
  const last = sessions.at(-1);
  return historySchema.parse({
    sessions,
    stats: parsedStats,
    nextCursor:
      rows.length > limit && last
        ? Buffer.from(
            JSON.stringify({ at: last.createdAt, id: last.id }),
          ).toString("base64url")
        : null,
  });
}
