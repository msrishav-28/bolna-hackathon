/** Private Node transport. Never import into browser components or log events.
 * Isolated provider validation only: a successful drain has no provider commit
 * acknowledgement and must not, by itself, authorize production scoring.
 */
import WebSocket from "ws";
import { z } from "zod";

export const SPEECH_SAMPLE_RATE = 16000;
export const SPEECH_FRAME_BYTES = 1024;
const MAX_AUDIO_BYTES = SPEECH_SAMPLE_RATE * 2 * 25;
const MAX_STT_BUFFERED_BYTES = 128 * 1024;
const eventSchema = z.object({ type: z.string().max(40) }).passthrough();
const connectedSchema = z.object({
  type: z.literal("connected"),
  request_id: z.string().min(1).max(200),
  config: z.object({
    sample_rate: z.literal(16000),
    chunk_size: z.literal(512),
    language_code: z.literal("en-IN"),
    format: z.literal("verbatim"),
  }),
});
export const finalSegmentSchema = z
  .object({
    type: z.literal("transcript"),
    text: z.string().max(20000),
    segment_id: z.string().min(1).max(240),
    segment_index: z.number().int().min(1),
    utterance_id: z.string().min(1).max(240),
    is_final: z.literal(true),
  })
  .passthrough();
export type FinalSegment = z.infer<typeof finalSegmentSchema>;
export type SpeechHandlers = {
  onSpeechStart: (utteranceId: string) => void;
  onFinal: (segment: FinalSegment) => void;
  onFailure: (code: string) => void;
};

function parseMessage(raw: WebSocket.RawData) {
  try {
    return eventSchema.parse(JSON.parse(raw.toString()));
  } catch {
    throw new Error("SPEECH_EVENT_INVALID");
  }
}

export class GnaniRecognition {
  private socket: WebSocket;
  private expectedClose = false;
  private failure: string | null = null;
  private pending = new Set<string>();
  private segments = new Map<number, FinalSegment>();
  private requestId = "";
  private lastEvent = 0;
  private connected = false;
  private finishing = false;
  private textLength = 0;
  readonly ready: Promise<void>;
  get requestIdentity() {
    if (!this.connected || this.failure) throw new Error("STT_NOT_READY");
    return this.requestId;
  }
  get inputDiagnostics() {
    return {
      readyState: this.socket.readyState,
      bufferedBytes: this.socket.bufferedAmount,
      connected: this.connected,
      finishing: this.finishing,
      failed: this.failure !== null,
    };
  }
  constructor(
    key: string,
    private handlers: SpeechHandlers,
  ) {
    if (!key || /[\r\n]/.test(key)) throw new Error("SPEECH_CONFIGURATION");
    this.socket = new WebSocket("wss://api.vachana.ai/stt/v3/stream", {
      headers: {
        "x-api-key-id": key,
        model: "prisma-v3.0",
        language_code: "en-IN",
        format: "verbatim",
        "x-sample-rate": "16000",
        "x-idle-timeout-sec": "360",
        enable_substitution: "false",
      },
      handshakeTimeout: 10000,
      maxPayload: 64000,
      followRedirects: false,
    });
    this.ready = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.fail("STT_CONNECTION_TIMEOUT");
        reject(new Error("STT_CONNECTION_TIMEOUT"));
      }, 12000);
      this.socket.on("message", (raw) => {
        if (this.expectedClose) return;
        try {
          const event = parseMessage(raw);
          this.lastEvent = performance.now();
          if (event.type === "connected") {
            if (this.connected) throw new Error("STT_DUPLICATE_CONNECTION");
            const ready = connectedSchema.parse(event);
            this.requestId = ready.request_id;
            this.connected = true;
            clearTimeout(timer);
            resolve();
          } else if (!this.connected) throw new Error("STT_NOT_READY");
          else if (event.type === "speech_start") {
            const id = z.string().min(1).max(240).parse(event.utterance_id);
            this.pending.add(id);
            handlers.onSpeechStart(id);
          } else if (event.type === "transcript") {
            const segment = finalSegmentSchema.parse(event);
            if (
              segment.segment_id !==
              `${this.requestId}-seg-${segment.segment_index}`
            )
              throw new Error("STT_IDENTITY_MISMATCH");
            const previous = this.segments.get(segment.segment_index);
            if (previous) {
              if (
                previous.segment_id !== segment.segment_id ||
                previous.text !== segment.text ||
                previous.utterance_id !== segment.utterance_id
              )
                throw new Error("STT_SEGMENT_CONFLICT");
              return;
            }
            this.textLength += segment.text.length;
            if (this.textLength > 120000 || this.segments.size >= 2000)
              throw new Error("STT_TRANSCRIPT_LIMIT");
            this.segments.set(segment.segment_index, segment);
            this.pending.delete(segment.utterance_id);
            handlers.onFinal(segment);
          } else if (event.type === "error")
            throw new Error("STT_PROVIDER_ERROR");
        } catch {
          clearTimeout(timer);
          this.fail("STT_EVENT_INVALID");
          reject(new Error("STT_EVENT_INVALID"));
        }
      });
      this.socket.on("error", () => {
        clearTimeout(timer);
        this.fail("STT_CONNECTION_FAILED");
        reject(new Error("STT_CONNECTION_FAILED"));
      });
      this.socket.on("close", () => {
        clearTimeout(timer);
        if (!this.expectedClose) this.fail("STT_DISCONNECTED");
        reject(new Error(this.failure ?? "STT_DISCONNECTED"));
      });
    });
  }
  private fail(code: string) {
    if (this.failure || this.expectedClose) return;
    this.failure = code;
    this.expectedClose = true;
    this.socket.terminate();
    this.handlers.onFailure(code);
  }
  send(frame: Buffer) {
    if (
      this.failure ||
      this.finishing ||
      !this.connected ||
      this.socket.readyState !== WebSocket.OPEN ||
      frame.length !== SPEECH_FRAME_BYTES ||
      this.socket.bufferedAmount > MAX_STT_BUFFERED_BYTES
    )
      throw new Error("STT_INPUT_UNAVAILABLE");
    this.socket.send(frame);
  }
  async finish() {
    if (
      this.failure ||
      this.finishing ||
      !this.connected ||
      this.socket.readyState !== WebSocket.OPEN
    )
      throw new Error("STT_FINALIZATION_FAILED");
    this.finishing = true;
    const started = performance.now();
    const drainOutgoing = async () => {
      while (this.socket.bufferedAmount > 0) {
        if (this.failure || this.socket.readyState !== WebSocket.OPEN)
          throw new Error("STT_FINALIZATION_FAILED");
        if (performance.now() - started >= 5000)
          throw new Error("STT_FINALIZATION_TIMEOUT");
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    };
    // This drains known utterances, not an undocumented provider commit ack.
    try {
      // The quiet window cannot begin while earlier PCM is still queued locally.
      await drainOutgoing();
      if (this.failure || this.socket.readyState !== WebSocket.OPEN)
        throw new Error("STT_FINALIZATION_FAILED");
      this.socket.send(JSON.stringify({ type: "commit" }));
      await drainOutgoing();
      const committedAt = performance.now();
      while (performance.now() - started < 12000) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        if (this.failure) throw new Error("STT_FINALIZATION_FAILED");
        if (
          !this.pending.size &&
          performance.now() - Math.max(this.lastEvent, committedAt) >= 1500
        ) {
          const ordered = [...this.segments.values()].sort(
            (a, b) => a.segment_index - b.segment_index,
          );
          if (
            ordered.some(
              (segment, index) => segment.segment_index !== index + 1,
            )
          )
            throw new Error("STT_SEGMENT_GAP");
          return ordered;
        }
      }
      throw new Error("STT_FINALIZATION_TIMEOUT");
    } finally {
      this.close();
    }
  }
  close() {
    this.expectedClose = true;
    this.socket.terminate();
  }
}

export async function synthesizeSpeech(
  key: string,
  text: string,
  voice: string,
  signal: AbortSignal,
  onAudio: (pcm: Buffer) => void,
) {
  if (
    !key ||
    /[\r\n]/.test(key) ||
    !text.trim() ||
    text.length > 1800 ||
    /[<>]/.test(text) ||
    ![
      "Shivani",
      "Lakshmi",
      "Kalpana",
      "Chetana",
      "Vasudha",
      "Riyaa",
      "Tarika",
      "Avinash",
      "Shubham",
      "Prakash",
      "Devansh",
      "Yashraj",
      "Harshad",
    ].includes(voice)
  )
    throw new Error("TTS_INPUT_INVALID");
  if (signal.aborted) throw new Error("TTS_CANCELLED");
  await new Promise<void>((resolve, reject) => {
    const socket = new WebSocket("wss://api.vachana.ai/api/v1/tts", {
      headers: { "X-API-Key-ID": key },
      handshakeTimeout: 10000,
      maxPayload: 262144,
      followRedirects: false,
    });
    let done = false,
      bytes = 0;
    let partialSample = Buffer.alloc(0);
    let expectedIndex: number | null = null;
    const finish = (error?: string) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      socket.terminate();
      if (error) reject(new Error(error));
      else resolve();
    };
    const abort = () => finish("TTS_CANCELLED");
    const timer = setTimeout(() => finish("TTS_TIMEOUT"), 20000);
    signal.addEventListener("abort", abort, { once: true });
    socket.on("open", () => {
      if (done) return;
      socket.send(
        JSON.stringify({
          text,
          voice,
          model: "timbre-v3.0",
          language: "en-IN",
          speed: 1,
          audio_config: {
            sample_rate: 16000,
            num_channels: 1,
            sample_width: 2,
            encoding: "linear_pcm",
            container: "raw",
          },
        }),
      );
    });
    socket.on("message", (raw) => {
      if (done) return;
      try {
        const event = parseMessage(raw);
        if (event.type === "start") return;
        if (event.type !== "audio" && event.type !== "complete")
          throw new Error();
        const data = z
          .object({
            chunk_index: z.number().int().min(0),
            audio: z.string().max(250000),
            is_final: z.boolean(),
          })
          .parse(event.data);
        if (
          expectedIndex === null
            ? data.chunk_index > 1
            : data.chunk_index !== expectedIndex
        )
          throw new Error();
        expectedIndex = data.chunk_index + 1;
        if (event.type === "complete") {
          if (!data.is_final || data.audio || !bytes || partialSample.length)
            throw new Error();
          finish();
          return;
        }
        if (data.is_final || !/^[A-Za-z0-9+/]+={0,2}$/.test(data.audio))
          throw new Error();
        const pcm = Buffer.from(data.audio, "base64");
        bytes += pcm.length;
        if (!pcm.length || bytes > MAX_AUDIO_BYTES) throw new Error();
        // Provider chunks are byte fragments, not guaranteed sample boundaries.
        // Carry an incomplete PCM16 sample; never pad or discard speech bytes.
        const joined = partialSample.length
          ? Buffer.concat([partialSample, pcm])
          : pcm;
        const end = joined.length - (joined.length % 2);
        partialSample = joined.subarray(end);
        if (end) onAudio(joined.subarray(0, end));
      } catch {
        finish("TTS_EVENT_INVALID");
      }
    });
    socket.on("error", () => finish("TTS_CONNECTION_FAILED"));
    socket.on("close", () => {
      if (!done) finish("TTS_INCOMPLETE");
    });
  });
}
