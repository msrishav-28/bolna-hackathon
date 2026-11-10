import type { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ sockets: [] as unknown[] }));
vi.mock("ws", async () => {
  const { EventEmitter } = await import("node:events");
  class Socket extends EventEmitter {
    static OPEN = 1;
    readyState = 1;
    bufferedAmount = 0;
    sent: unknown[] = [];
    closed = false;
    constructor(
      public url: string,
      public options: unknown,
    ) {
      super();
      state.sockets.push(this);
    }
    send(value: unknown) {
      this.sent.push(value);
    }
    terminate() {
      if (this.closed) return;
      this.closed = true;
      this.readyState = 3;
      this.emit("close");
    }
    event(value: unknown) {
      this.emit("message", Buffer.from(JSON.stringify(value)));
    }
  }
  return { default: Socket };
});

import {
  GnaniRecognition,
  synthesizeSpeech,
} from "../src/lib/voice/gnani-speech";

type Socket = EventEmitter & {
  url: string;
  options: { headers: Record<string, string> };
  sent: unknown[];
  closed: boolean;
  bufferedAmount: number;
  event(value: unknown): void;
};
const latest = () => state.sockets.at(-1) as Socket;
const handlers = () => ({
  onSpeechStart: vi.fn(),
  onFinal: vi.fn(),
  onFailure: vi.fn(),
});
const segment = (index = 1, text = "Synthetic practice words.") => ({
  type: "transcript",
  text,
  segment_id: `request-seg-${index}`,
  segment_index: index,
  utterance_id: `utterance-${index}`,
  is_final: true,
});
async function recognition() {
  const calls = handlers();
  const client = new GnaniRecognition("synthetic-key", calls);
  const socket = latest();
  socket.event({
    type: "connected",
    request_id: "request",
    config: {
      sample_rate: 16000,
      chunk_size: 512,
      language_code: "en-IN",
      format: "verbatim",
    },
  });
  await client.ready;
  return { client, socket, calls };
}
const audio = (index: number, pcm = Buffer.alloc(1024)) => ({
  type: "audio",
  data: { chunk_index: index, audio: pcm.toString("base64"), is_final: false },
});
const complete = (index: number) => ({
  type: "complete",
  data: { chunk_index: index, audio: "", is_final: true },
});

beforeEach(() => {
  state.sockets.length = 0;
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe("private Prisma streaming boundary", () => {
  it("pins English/verbatim v3, exact PCM framing and bounded backpressure", async () => {
    const { client, socket } = await recognition();
    expect(socket.url).toBe("wss://api.vachana.ai/stt/v3/stream");
    expect(socket.options.headers).toMatchObject({
      model: "prisma-v3.0",
      language_code: "en-IN",
      format: "verbatim",
      "x-sample-rate": "16000",
    });
    client.send(Buffer.alloc(1024));
    expect(socket.sent).toHaveLength(1);
    expect(() => client.send(Buffer.alloc(1023))).toThrow(
      "STT_INPUT_UNAVAILABLE",
    );
    socket.bufferedAmount = 64000;
    const delayedFrame = Buffer.alloc(1024, 7);
    client.send(delayedFrame);
    expect(socket.sent.at(-1)).toBe(delayedFrame);
    expect(socket.sent).toHaveLength(2);
    socket.bufferedAmount = 128 * 1024 + 1;
    expect(() => client.send(Buffer.alloc(1024))).toThrow(
      "STT_INPUT_UNAVAILABLE",
    );
    expect(socket.sent).toHaveLength(2);
    client.close();
  });

  it("deduplicates finals, orders them and drains known utterances", async () => {
    const { client, socket, calls } = await recognition();
    socket.event({ type: "speech_start", utterance_id: "utterance-1" });
    socket.event(segment(2));
    const result = client.finish();
    expect(() => client.send(Buffer.alloc(1024))).toThrow();
    socket.event(segment(1));
    socket.event(segment(1));
    await vi.advanceTimersByTimeAsync(1500);
    expect((await result).map((s) => s.segment_index)).toEqual([1, 2]);
    expect(calls.onFinal).toHaveBeenCalledTimes(2);
    expect(socket.sent).toContain(JSON.stringify({ type: "commit" }));
    expect(socket.closed).toBe(true);
  });

  it("waits for queued PCM before committing and starting the final quiet window", async () => {
    const { client, socket } = await recognition();
    socket.event(segment(1));
    socket.bufferedAmount = 64000;
    let settled = false;
    const result = client.finish().then((finals) => {
      settled = true;
      return finals;
    });
    await vi.advanceTimersByTimeAsync(2000);
    expect(socket.sent).not.toContain(JSON.stringify({ type: "commit" }));
    expect(settled).toBe(false);
    socket.bufferedAmount = 0;
    await vi.advanceTimersByTimeAsync(1450);
    expect(socket.sent).toContain(JSON.stringify({ type: "commit" }));
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(100);
    expect(await result).toHaveLength(1);
    expect(socket.closed).toBe(true);
  });

  it("rejects an undrained upload instead of scoring before its queued audio is sent", async () => {
    const { client, socket } = await recognition();
    socket.event(segment(1));
    socket.bufferedAmount = 64000;
    const rejected = expect(client.finish()).rejects.toThrow(
      "STT_FINALIZATION_TIMEOUT",
    );
    await vi.advanceTimersByTimeAsync(5050);
    await rejected;
    expect(socket.sent).not.toContain(JSON.stringify({ type: "commit" }));
    expect(socket.closed).toBe(true);
  });

  it("rejects a gap and closes rather than returning partial evidence", async () => {
    const { client, socket } = await recognition();
    socket.event(segment(2));
    const result = expect(client.finish()).rejects.toThrow("STT_SEGMENT_GAP");
    await vi.advanceTimersByTimeAsync(1500);
    await result;
    expect(socket.closed).toBe(true);
  });
  it("retains empty finals in sequence and closes their pending utterance", async () => {
    const { client, socket, calls } = await recognition();
    socket.event({ type: "speech_start", utterance_id: "utterance-1" });
    socket.event(segment(1, ""));
    socket.event(segment(2));
    const result = client.finish();
    await vi.advanceTimersByTimeAsync(1500);
    expect((await result).map((s) => [s.segment_index, s.text])).toEqual([
      [1, ""],
      [2, "Synthetic practice words."],
    ]);
    expect(calls.onFailure).not.toHaveBeenCalled();
  });

  it("times out an utterance lacking its final segment", async () => {
    const { client, socket } = await recognition();
    socket.event({ type: "speech_start", utterance_id: "unfinished" });
    const result = expect(client.finish()).rejects.toThrow(
      "STT_FINALIZATION_TIMEOUT",
    );
    await vi.advanceTimersByTimeAsync(12000);
    await result;
    expect(socket.closed).toBe(true);
  });

  it.each([
    { ...segment(), segment_id: "other-seg-1" },
    { ...segment(), segment_id: "request-seg-2" },
    { ...segment(), is_final: false },
  ])("fails closed on mismatched or non-final evidence", async (event) => {
    const { client, socket, calls } = await recognition();
    socket.event(event);
    expect(calls.onFinal).not.toHaveBeenCalled();
    expect(calls.onFailure).toHaveBeenCalledOnce();
    await expect(client.finish()).rejects.toThrow();
    expect(socket.closed).toBe(true);
  });

  it("rejects conflicting duplicates without replacing the first final", async () => {
    const { client, socket, calls } = await recognition();
    socket.event(segment());
    socket.event(segment(1, "Changed synthetic content."));
    expect(calls.onFinal).toHaveBeenCalledOnce();
    expect(calls.onFinal.mock.calls[0][0].text).toBe(
      "Synthetic practice words.",
    );
    await expect(client.finish()).rejects.toThrow();
  });

  it("bounds connection wait and reports no upstream payload", async () => {
    const calls = handlers();
    const client = new GnaniRecognition("synthetic-key", calls);
    const result = expect(client.ready).rejects.toThrow(
      "STT_CONNECTION_TIMEOUT",
    );
    await vi.advanceTimersByTimeAsync(12000);
    await result;
    expect(calls.onFailure).toHaveBeenCalledWith("STT_CONNECTION_TIMEOUT");
    expect(latest().closed).toBe(true);
  });
});

describe("private Timbre streaming boundary", () => {
  function synthesis() {
    const controller = new AbortController(),
      onAudio = vi.fn();
    const result = synthesizeSpeech(
      "synthetic-key",
      "Synthetic words.",
      "Shivani",
      controller.signal,
      onAudio,
    );
    const socket = latest();
    socket.emit("open");
    return { controller, onAudio, result, socket };
  }

  it.each([0, 1])(
    "accepts contiguous PCM chunks starting at %i and explicit completion",
    async (start) => {
      const { socket, result, onAudio } = synthesis();
      expect(JSON.parse(socket.sent[0] as string)).toMatchObject({
        model: "timbre-v3.0",
        language: "en-IN",
        audio_config: { container: "raw", sample_rate: 16000 },
      });
      socket.event(audio(start));
      socket.event(audio(start + 1));
      socket.event(complete(start + 2));
      await result;
      expect(onAudio).toHaveBeenCalledTimes(2);
      expect(socket.closed).toBe(true);
    },
  );

  it.each(["gap", "bad-first", "odd-pcm", "early-complete", "invalid-base64"])(
    "rejects %s without success",
    async (kind) => {
      const { socket, result } = synthesis();
      const rejected = expect(result).rejects.toThrow("TTS_EVENT_INVALID");
      if (kind === "gap") {
        socket.event(audio(0));
        socket.event(audio(2));
      }
      if (kind === "bad-first") socket.event(audio(3));
      if (kind === "odd-pcm") {
        socket.event(audio(0, Buffer.alloc(3)));
        socket.event(complete(1));
      }
      if (kind === "early-complete") socket.event(complete(0));
      if (kind === "invalid-base64")
        socket.event({
          type: "audio",
          data: { chunk_index: 0, audio: "%%%", is_final: false },
        });
      await rejected;
      expect(socket.closed).toBe(true);
    },
  );

  it("cancels immediately and delivers no late audio", async () => {
    const { socket, result, controller, onAudio } = synthesis();
    const rejected = expect(result).rejects.toThrow("TTS_CANCELLED");
    controller.abort();
    socket.event(audio(0));
    const sentBeforeLateOpen = socket.sent.length;
    socket.emit("open");
    await rejected;
    expect(socket.closed).toBe(true);
    expect(onAudio).not.toHaveBeenCalled();
    expect(socket.sent).toHaveLength(sentBeforeLateOpen);
  });

  it("reassembles PCM16 samples split across provider byte chunks without padding", async () => {
    const { socket, result, onAudio } = synthesis();
    socket.event(audio(0, Buffer.from([1, 2, 3])));
    socket.event(audio(1, Buffer.from([4, 5, 6])));
    socket.event(complete(2));
    await result;
    expect(Buffer.concat(onAudio.mock.calls.map(([pcm]) => pcm))).toEqual(
      Buffer.from([1, 2, 3, 4, 5, 6]),
    );
    expect(onAudio.mock.calls.every(([pcm]) => pcm.length % 2 === 0)).toBe(
      true,
    );
  });

  it("rejects an abrupt close without a completion event", async () => {
    const { socket, result } = synthesis();
    const rejected = expect(result).rejects.toThrow("TTS_INCOMPLETE");
    socket.emit("close");
    await rejected;
  });

  it("bounds synthesis time and rejects markup or unsupported voices before connecting", async () => {
    const { result } = synthesis();
    const rejected = expect(result).rejects.toThrow("TTS_TIMEOUT");
    await vi.advanceTimersByTimeAsync(20000);
    await rejected;
    const count = state.sockets.length;
    await expect(
      synthesizeSpeech(
        "key",
        "<script>words</script>",
        "Shivani",
        new AbortController().signal,
        vi.fn(),
      ),
    ).rejects.toThrow("TTS_INPUT_INVALID");
    await expect(
      synthesizeSpeech(
        "key",
        "words",
        "Unknown",
        new AbortController().signal,
        vi.fn(),
      ),
    ).rejects.toThrow("TTS_INPUT_INVALID");
    expect(state.sockets).toHaveLength(count);
  });
});
