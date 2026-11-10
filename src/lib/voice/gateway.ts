import { createHash } from "node:crypto";
import type WebSocket from "ws";
import { z } from "zod";
import { startPcmPacer } from "./pcm-pacer.js";
import { SpeechStorageUnavailableError } from "./storage-retry.js";
import {
  GnaniRecognition,
  synthesizeSpeech,
  type FinalSegment,
} from "./gnani-speech.js";
import {
  clientControlSchema,
  SPEECH_PROTOCOL,
  type Actor,
} from "./protocol.js";
import {
  conversationReply,
  nextActor,
  voiceFor,
  type EvidenceTurn,
} from "./dialogue.js";

const contextSchema = z.object({
  runId: z.uuid(),
  sessionId: z.uuid(),
  mode: z.enum([
    "interview",
    "viva",
    "debate",
    "group_discussion",
    "presentation",
  ]),
  topic: z.string().min(1).max(240),
  difficulty: z.enum(["gentle", "standard", "intense"]),
  durationSeconds: z.union([z.literal(180), z.literal(300)]),
  startedAt: z.iso.datetime({ offset: true }),
  deadline: z.iso.datetime({ offset: true }),
});
export type GatewayContext = z.infer<typeof contextSchema>;
export type GatewayStore = {
  rpc(name: string, args: Record<string, unknown>): Promise<unknown>;
};
export type GatewayFailure =
  | "AUTH_TIMEOUT"
  | "START_FAILED"
  | "CLIENT_PROTOCOL"
  | "FRAME_BEFORE_READY"
  | "FRAME_INVALID"
  | "INPUT_BACKPRESSURE"
  | "INPUT_RATE"
  | "DISCONNECTED"
  | "STORAGE_FAILED"
  | "STT_FAILED"
  | "STT_INPUT_FAILED"
  | "CAPTURE_STALLED"
  | "TTS_FAILED"
  | "DIALOGUE_FAILED"
  | "FINALIZATION_FAILED"
  | "SHUTDOWN";

// Hosted WebSockets can deliver a delayed group of microphone frames together.
// Tolerate a bounded network interruption without dropping or accelerating evidence.
const maxQueuedFrames = 512;
const inputDrainTimeoutMs = 18000;
const maxInputGapMs = 15000;
// Stop before the database's 45-second stale-run fence, including RPC latency.
const maxUnconfirmedLivenessMs = 30000;

/** One connection owns one non-resumable execution. No audio is persisted. */
export class SpeechConnection {
  private context: GatewayContext | null = null;
  private recognition: GnaniRecognition | null = null;
  private authenticated = false;
  private ending = false;
  private ended = false;
  private frames: Buffer[] = [];
  private pending = new Map<number, FinalSegment>();
  private persistedIndex = 0;
  private writeQueue: Promise<void> = Promise.resolve();
  private turns: EvidenceTurn[] = [];
  private activeUtterances = new Set<string>();
  private lastFinal: number | null = null;
  private lastInput = performance.now();
  private startedMono = Infinity;
  private deadlineMono = Infinity;
  private busy = false;
  private responseJob: Promise<void> | null = null;
  private generation = 0;
  private controller: AbortController | null = null;
  private nextPromptAt = Infinity;
  private aiTurns = 0;
  private aiBytes = 0;
  private totalFrames = 0;
  private pacedFrames = 0;
  private silenceFrames = 0;
  private stopPacer: (() => void) | null = null;
  private scheduler: ReturnType<typeof setInterval> | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private heartbeatPending = false;
  private lastConfirmedLiveness = Infinity;
  private authTimer: ReturnType<typeof setTimeout>;

  constructor(
    private socket: WebSocket,
    private store: GatewayStore,
    private key: string,
    private onFailure: (reason: GatewayFailure) => void = () => {},
  ) {
    this.authTimer = setTimeout(() => void this.fail("AUTH_TIMEOUT"), 5000);
    socket.on("message", (raw, binary) => {
      if (this.ended || this.ending) return;
      try {
        if (binary) {
          if (
            !this.authenticated ||
            !this.recognition ||
            !Number.isFinite(this.startedMono)
          )
            throw new Error("FRAME_BEFORE_READY");
          if (!Buffer.isBuffer(raw) || raw.length !== 1024)
            throw new Error("FRAME_INVALID");
          if (this.frames.length >= maxQueuedFrames)
            throw new Error("INPUT_BACKPRESSURE");
          const frame = Buffer.from(raw as Buffer);
          // Reject uploads accelerated beyond microphone time, including repeated bursts.
          if (
            ++this.totalFrames * 32 >
            performance.now() - this.startedMono + 1000
          )
            throw new Error("INPUT_RATE");
          this.lastInput = performance.now();
          this.frames.push(frame);
          return;
        }
        const control = clientControlSchema.parse(JSON.parse(raw.toString()));
        if (control.type === "authenticate") {
          if (this.authenticated || this.context) throw new Error();
          // Mark before awaiting the database, preventing parallel grant consumption.
          this.authenticated = true;
          clearTimeout(this.authTimer);
          this.authTimer = setTimeout(
            () => void this.fail("START_FAILED"),
            20000,
          );
          void this.open(control.grant).catch(() => this.fail("START_FAILED"));
        } else if (!this.context || !this.recognition) throw new Error();
        else if (control.type === "end") void this.end("manual");
        else if (control.type === "ping") this.send({ type: "pong" });
      } catch (error) {
        const code = error instanceof Error ? error.message : "";
        void this.fail(
          [
            "FRAME_BEFORE_READY",
            "FRAME_INVALID",
            "INPUT_BACKPRESSURE",
            "INPUT_RATE",
          ].includes(code)
            ? (code as GatewayFailure)
            : "CLIENT_PROTOCOL",
        );
      }
    });
    socket.on("close", () => {
      if (!this.ended && !this.ending) void this.fail("DISCONNECTED");
    });
    socket.on("error", () => void this.fail("DISCONNECTED"));
  }
  private send(value: unknown) {
    if (this.socket.readyState !== 1 || this.socket.bufferedAmount > 256000)
      throw new Error("VOICE_BACKPRESSURE");
    this.socket.send(JSON.stringify(value));
  }
  private event(action: string, data: unknown = {}) {
    const requestedAt = performance.now();
    return this.store
      .rpc("speech_event", {
        p_run: this.context!.runId,
        p_action: action,
        p_data: data,
      })
      .then((result) => {
        if (action === "student" || action === "heartbeat")
          // An exact replay may acknowledge an earlier commit. Use its conservative
          // request time, and never move liveness backwards on out-of-order replies.
          this.lastConfirmedLiveness = Math.max(
            this.lastConfirmedLiveness,
            requestedAt,
          );
        return result;
      });
  }
  private enqueue(task: () => Promise<void>) {
    this.writeQueue = this.writeQueue.then(task);
    void this.writeQueue.catch(() => this.fail("STORAGE_FAILED"));
  }
  private async open(grant: string) {
    const hash = createHash("sha256").update(grant).digest("hex");
    this.context = contextSchema.parse(
      await this.store.rpc("consume_speech_grant", { p_hash: hash }),
    );
    if (this.ended || this.ending) {
      await this.event("fail");
      return;
    }
    this.recognition = new GnaniRecognition(this.key, {
      onSpeechStart: (id) => {
        this.activeUtterances.add(id);
        this.controller?.abort();
        ++this.generation;
        try {
          this.send({ type: "clear", generation: this.generation });
          this.send({ type: "state", state: "listening", actor: "student" });
        } catch {
          void this.fail();
        }
      },
      onFinal: (segment) => {
        if (this.ended) return;
        this.activeUtterances.delete(segment.utterance_id);
        this.pending.set(segment.segment_index, segment);
        this.enqueue(async () => {
          while (this.pending.has(this.persistedIndex + 1)) {
            const final = this.pending.get(this.persistedIndex + 1)!;
            await this.event("student", {
              index: final.segment_index,
              segmentId: final.segment_id,
              utteranceId: final.utterance_id,
              text: final.text,
            });
            if (final.text.trim()) {
              this.turns.push({ actor: "student", text: final.text });
              this.lastFinal = performance.now();
              this.nextPromptAt = Math.max(
                this.nextPromptAt === Infinity ? 0 : this.nextPromptAt,
                this.lastFinal + 1800,
              );
            }
            this.pending.delete(++this.persistedIndex);
          }
        });
      },
      onFailure: () => void this.fail("STT_FAILED"),
    });
    await this.recognition.ready;
    if (this.ended || this.ending) {
      this.recognition.close();
      return;
    }
    const clock = z
      .object({
        startedAt: z.iso.datetime({ offset: true }),
        deadline: z.iso.datetime({ offset: true }),
      })
      .parse(
        await this.store.rpc("start_speech", {
          p_run: this.context.runId,
          p_request: this.recognition.requestIdentity,
        }),
      );
    this.context = { ...this.context, ...clock };
    this.startedMono = performance.now();
    this.lastConfirmedLiveness = this.startedMono;
    this.deadlineMono = this.startedMono + this.context.durationSeconds * 1000;
    clearTimeout(this.authTimer);
    this.lastInput = performance.now();
    this.send({
      type: "ready",
      runId: this.context.runId,
      deadline: this.context.deadline,
      sampleRate: 16000,
      remainingMilliseconds: this.context.durationSeconds * 1000,
    });
    this.stopPacer = startPcmPacer(
      () => {
        const frame = this.frames.shift();
        this.recognition!.send(frame ?? Buffer.alloc(1024));
        ++this.pacedFrames;
        if (!frame) ++this.silenceFrames;
      },
      (reason, lagMs) => {
        console.warn(
          JSON.stringify({
            event: "speech_input_rejected",
            reason,
            lagMs,
            queuedFrames: this.frames.length,
            providerInput: this.recognition?.inputDiagnostics,
          }),
        );
        void this.fail("STT_INPUT_FAILED");
      },
    );
    this.scheduler = setInterval(() => {
      if (this.ending || this.ended) return;
      const now = performance.now(),
        deadline = this.deadlineMono;
      if (now >= deadline) {
        void this.end("deadline");
        return;
      }
      if (now - this.lastInput > maxInputGapMs) {
        void this.fail("CAPTURE_STALLED");
        return;
      }
      if (now - this.lastConfirmedLiveness >= maxUnconfirmedLivenessMs) {
        void this.fail("STORAGE_FAILED");
        return;
      }
      if (
        now >= this.nextPromptAt &&
        !this.busy &&
        !this.activeUtterances.size &&
        deadline - now > 10000
      )
        this.responseJob = this.respond().finally(() => {
          this.responseJob = null;
        });
    }, 250);
    this.heartbeat = setInterval(() => {
      if (this.ending || this.ended || this.heartbeatPending) return;
      this.heartbeatPending = true;
      // A transient metadata write must not poison the immutable-evidence queue.
      // Confirmed student writes also refresh liveness; the scheduler still fences outages.
      void this.event("heartbeat")
        .catch((error: unknown) => {
          if (this.ending || this.ended) return;
          if (!(error instanceof SpeechStorageUnavailableError))
            void this.fail("STORAGE_FAILED");
        })
        .finally(() => {
          this.heartbeatPending = false;
        });
    }, 10000);
    this.nextPromptAt = performance.now() + 25000;
    const opening =
      this.context.mode === "presentation"
        ? `Welcome. You have ${Math.floor((this.context.durationSeconds * 2) / 3)} seconds to present on ${this.context.topic}. I will listen without interrupting, then ask questions.`
        : this.context.mode === "group_discussion"
          ? `Welcome. I am the AI moderator. Two AI peers will contribute different views. Our topic is: ${this.context.topic}. Please share your opening view.`
          : `Welcome to your ${this.context.mode} practice. Our topic is: ${this.context.topic}. Please start with your opening explanation.`;
    this.responseJob = this.speak(
      this.context.mode === "group_discussion" ? "moderator" : "coach",
      opening,
    )
      .catch((error) =>
        this.fail(
          error instanceof Error && error.message === "GATEWAY_STORAGE_FAILED"
            ? "STORAGE_FAILED"
            : "TTS_FAILED",
        ),
      )
      .finally(() => {
        this.responseJob = null;
      });
  }
  private async respond() {
    const context = this.context!;
    const now = performance.now();
    const inputVersion = this.persistedIndex;
    if (
      context.mode === "presentation" &&
      now < this.startedMono + (context.durationSeconds * 1000 * 2) / 3
    )
      return;
    if (
      this.aiTurns >= 17 ||
      this.aiBytes >= context.durationSeconds * 32000 * 0.35
    ) {
      this.nextPromptAt = Infinity;
      return;
    }
    // Never pepper silence with questions: after a prompt, wait for a new student final.
    if (this.lastFinal === null && this.aiTurns > 0) {
      this.nextPromptAt = Infinity;
      return;
    }
    this.busy = true;
    const controller = new AbortController();
    this.controller = controller;
    const generation = ++this.generation;
    const actor = nextActor(context.mode, this.aiTurns);
    try {
      this.send({ type: "state", state: "thinking", actor });
      const text = await conversationReply(
        {
          ...context,
          actor,
          turns: this.turns,
          closing: this.deadlineMono - now < 35000,
        },
        controller.signal,
        (code) => {
          // Fixed categories only: never log provider bodies or conversation text.
          console.warn(JSON.stringify({ event: "dialogue_rejected", code }));
        },
      );
      if (
        this.ending ||
        this.ended ||
        controller.signal.aborted ||
        generation !== this.generation
      )
        return;
      await this.speak(actor, text);
      if (this.persistedIndex === inputVersion) this.lastFinal = null;
    } catch (error) {
      if (!controller.signal.aborted && !this.ending && !this.ended)
        await this.fail(
          error instanceof Error && error.message === "GATEWAY_STORAGE_FAILED"
            ? "STORAGE_FAILED"
            : "DIALOGUE_FAILED",
        );
    } finally {
      this.busy = false;
    }
  }
  private async speak(actor: Actor, text: string) {
    this.busy = true;
    const controller = new AbortController();
    this.controller = controller;
    const generation = ++this.generation;
    const turn = z
      .object({ id: z.number().int().positive() })
      .parse(await this.event("assistant", { actor, text }));
    let bytes = 0,
      sent = false;
    let deliveryPending = false;
    try {
      this.send({ type: "state", state: "speaking", actor });
      await synthesizeSpeech(
        this.key,
        text,
        voiceFor(actor),
        controller.signal,
        (pcm) => {
          if (this.ending || this.ended || generation !== this.generation)
            return;
          if (
            this.aiBytes + bytes + pcm.length >
            this.context!.durationSeconds * 32000 * 0.35
          ) {
            controller.abort();
            this.send({ type: "clear", generation: ++this.generation });
            throw new Error("AI_AUDIO_BUDGET");
          }
          bytes += pcm.length;
          this.send({ type: "audio", generation, pcm: pcm.toString("base64") });
          sent = true;
        },
      );
      if (controller.signal.aborted || generation !== this.generation)
        throw new Error("CANCELLED");
      deliveryPending = true;
      await this.event("delivery", { id: turn.id, state: "sent" });
      this.turns.push({ actor, text });
    } catch (error) {
      // A timed-out sent update may have committed. Never overwrite it as interrupted.
      if (deliveryPending) throw new Error("GATEWAY_STORAGE_FAILED");
      const transportCode = error instanceof Error ? error.message : "";
      if (
        /^TTS_(INPUT_INVALID|CANCELLED|TIMEOUT|EVENT_INVALID|CONNECTION_FAILED|INCOMPLETE)$/.test(
          transportCode,
        ) &&
        !controller.signal.aborted
      ) {
        console.warn(
          JSON.stringify({
            event: "speech_synthesis_rejected",
            code: transportCode,
          }),
        );
      }
      await this.event("delivery", { id: turn.id, state: "interrupted" });
      if (!controller.signal.aborted && !this.ending && !this.ended)
        throw new Error("VOICE_FAILED");
    } finally {
      this.aiBytes += bytes;
      ++this.aiTurns;
      this.busy = false;
      if (!this.ending && !this.ended) {
        this.nextPromptAt = performance.now() + (sent ? bytes / 32 : 0) + 20000;
        this.send({ type: "state", state: "listening", actor: "student" });
      }
    }
  }
  async end(reason: "manual" | "deadline") {
    if (this.ending || this.ended) return;
    this.ending = true;
    if (performance.now() >= this.deadlineMono) reason = "deadline";
    this.controller?.abort();
    ++this.generation;
    try {
      this.send({ type: "clear", generation: this.generation });
      if (!this.context || !this.recognition) throw new Error();
      if (this.scheduler) clearInterval(this.scheduler);
      if (this.heartbeat) clearInterval(this.heartbeat);
      await this.event("drain");
      await this.responseJob?.catch(() => {});
      // Continue exact frame pacing while queued microphone data and a silence tail drain.
      const waiting = performance.now();
      while (
        this.frames.length &&
        performance.now() - waiting < inputDrainTimeoutMs
      )
        await new Promise((resolve) => setTimeout(resolve, 32));
      if (this.frames.length) throw new Error("INPUT_GAP");
      await new Promise((resolve) => setTimeout(resolve, 1100));
      this.stopPacer?.();
      const final = await this.recognition.finish();
      await this.writeQueue;
      if (this.pending.size || this.persistedIndex !== final.length)
        throw new Error("EVIDENCE_GAP");
      await this.event("complete", { segments: final.length, reason });
      this.send({ type: "ended", reason });
      this.ended = true;
      this.cleanup();
      this.socket.close(1000);
    } catch {
      await this.fail("FINALIZATION_FAILED");
    }
  }
  async fail(reason: GatewayFailure = "SHUTDOWN") {
    if (this.ended) return;
    this.ended = true;
    if (Number.isFinite(this.startedMono)) {
      // Transport counters only: no session identity, audio or transcript content.
      console.warn(
        JSON.stringify({
          event: "speech_transport_stopped",
          code: reason,
          elapsedMs: Math.round(performance.now() - this.startedMono),
          receivedFrames: this.totalFrames,
          pacedFrames: this.pacedFrames,
          silenceFrames: this.silenceFrames,
          queuedFrames: this.frames.length,
          inputGapMs: Math.round(performance.now() - this.lastInput),
        }),
      );
    }
    this.onFailure(reason);
    this.ending = true;
    this.cleanup();
    if (this.context) {
      try {
        await this.event("fail");
      } catch {
        /* Durable orphan recovery fails closed. */
      }
    }
    try {
      this.send({ type: "error", code: "VOICE_FAILED" });
    } catch {}
    this.socket.close(1011);
  }
  private cleanup() {
    clearTimeout(this.authTimer);
    this.stopPacer?.();
    if (this.scheduler) clearInterval(this.scheduler);
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.controller?.abort();
    this.recognition?.close();
    this.frames.length = 0;
  }
}

export { SPEECH_PROTOCOL };
