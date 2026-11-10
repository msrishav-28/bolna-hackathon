// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/client/api";
import { GnaniVoice, voiceSessionSchema } from "@/lib/client/gnani-voice";
const request = vi.hoisted(() => vi.fn());
vi.mock("@/lib/client/product-api", () => ({ productRequest: request }));
const stopTrack = vi.fn(),
  closeAudio = vi.fn(),
  send = vi.fn();
let grant: (value: unknown) => void;
let streamPromise: Promise<unknown>;
let socket: FakeSocket;
let capturePort: {
  onmessage: ((event: { data: unknown }) => void) | null;
};
class FakeSocket {
  static OPEN = 1;
  readyState = 1;
  bufferedAmount = 0;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  send = send;
  constructor() {
    // Expose the constructed socket so tests can drive actual connection events.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    socket = this;
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
}
beforeEach(() => {
  vi.clearAllMocks();
  streamPromise = Promise.resolve({
    getTracks: () => [{ stop: stopTrack }],
    getAudioTracks: () => [{ enabled: true }],
  });
  vi.stubGlobal("navigator", {
    mediaDevices: { getUserMedia: () => streamPromise },
  });
  vi.stubGlobal(
    "AudioContext",
    class {
      state = "running";
      sampleRate = 44100;
      currentTime = 0;
      destination = {};
      resume = async () => {};
      close = async () => {
        closeAudio();
      };
      audioWorklet = { addModule: async () => {} };
      createGain = () => ({ gain: { value: 1 }, connect: vi.fn() });
      createMediaStreamSource = () => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
      });
    },
  );
  vi.stubGlobal(
    "AudioWorkletNode",
    class {
      port = {
        onmessage: null as ((event: { data: unknown }) => void) | null,
        postMessage: () => {
          this.port.onmessage?.({ data: { type: "flushed" } });
        },
      };
      constructor() {
        capturePort = this.port;
      }
      connect = vi.fn();
      disconnect = vi.fn();
    },
  );
  vi.stubGlobal("WebSocket", FakeSocket);
  request.mockResolvedValue({
    runId: "20000000-0000-4000-8000-000000000001",
    grant: "a".repeat(43),
    websocketUrl: "wss://voice.example.test/speech",
    expiresAt: new Date(Date.now() + 120000).toISOString(),
    protocol: "samvaad-speech-v1",
  });
});
afterEach(() => vi.unstubAllGlobals());
const flush = async () => {
  for (let n = 0; n < 12; n++) await Promise.resolve();
};
function ready() {
  socket.onmessage?.({
    data: JSON.stringify({
      type: "ready",
      runId: "20000000-0000-4000-8000-000000000001",
      deadline: new Date(Date.now() + 180000).toISOString(),
      remainingMilliseconds: 180000,
      sampleRate: 16000,
    }),
  });
}
it("rejects an insecure or incompatible voice grant", () => {
  expect(
    voiceSessionSchema.safeParse({
      conversationId: "x",
      websocketUrl: "ws://voice.example.test",
      expiresAt: new Date().toISOString(),
      protocol: "gnani-pcm-v1",
    }).success,
  ).toBe(false);
  expect(
    voiceSessionSchema.safeParse({
      conversationId: "x",
      websocketUrl: "wss://voice.example.test",
      expiresAt: new Date().toISOString(),
      protocol: "another-provider",
    }).success,
  ).toBe(false);
});
it("does not acquire devices before explicit start and cleans a late permission grant", async () => {
  streamPromise = new Promise((resolve) => {
    grant = resolve;
  });
  const voice = new GnaniVoice({
    sessionUrl: "/api/sessions/test/voice-session",
  });
  expect(request).not.toHaveBeenCalled();
  const started = voice.start();
  await flush();
  await voice.stop();
  grant({ getTracks: () => [{ stop: stopTrack }] });
  await started;
  expect(stopTrack).toHaveBeenCalledOnce();
  expect(closeAudio).toHaveBeenCalledOnce();
  expect(request).not.toHaveBeenCalled();
});
it("reports denied microphone permission without reserving a paid run", async () => {
  streamPromise = Promise.reject(new DOMException("Denied", "NotAllowedError"));
  const voice = new GnaniVoice({
      sessionUrl: "/api/sessions/test/voice-session",
    }),
    error = vi.fn();
  voice.on("error", error);
  await expect(voice.start()).rejects.toThrow("Voice connection failed");
  expect(error).toHaveBeenCalledWith({ code: "microphone_denied" });
  expect(request).not.toHaveBeenCalled();
  expect(closeAudio).toHaveBeenCalledOnce();
});
it("starts the documented protocol once and stops every local resource", async () => {
  const voice = new GnaniVoice({
    sessionUrl: "/api/sessions/test/voice-session",
  });
  const active = vi.fn();
  voice.on("call-start", active);
  const started = voice.start();
  await flush();
  socket.onopen?.();
  ready();
  await started;
  expect(active).toHaveBeenCalledOnce();
  expect(send).toHaveBeenCalledWith(
    JSON.stringify({
      type: "authenticate",
      grant: "a".repeat(43),
      protocol: "samvaad-speech-v1",
    }),
  );
  const stopped = voice.stop();
  await flush();
  socket.onmessage?.({
    data: JSON.stringify({ type: "ended", reason: "manual" }),
  });
  await stopped;
  expect(stopTrack).toHaveBeenCalledOnce();
  expect(closeAudio).toHaveBeenCalledOnce();
  await expect(voice.start()).rejects.toThrow("Already attempted");
  expect(request).toHaveBeenCalledOnce();
});
it("fails closed on malformed provider messages without logging their content", async () => {
  const voice = new GnaniVoice({
    sessionUrl: "/api/sessions/test/voice-session",
  });
  const error = vi.fn();
  voice.on("error", error);
  const started = voice.start();
  await flush();
  socket.onopen?.();
  ready();
  await started;
  socket.onmessage?.({ data: "not json" });
  await flush();
  expect(error).toHaveBeenCalledWith({ code: "connect_failed" });
  expect(stopTrack).toHaveBeenCalledOnce();
  expect(voice.getState()).toBe("ended");
});
it("releases microphone and rejects if the audio worklet cannot be constructed", async () => {
  vi.stubGlobal(
    "AudioWorkletNode",
    class {
      constructor() {
        throw new Error("Unavailable");
      }
    },
  );
  const voice = new GnaniVoice({
    sessionUrl: "/api/sessions/test/voice-session",
  });
  const started = voice.start();
  const rejected = expect(started).rejects.toThrow("Voice connection failed");
  await flush();
  await rejected;
  expect(stopTrack).toHaveBeenCalledOnce();
  expect(closeAudio).toHaveBeenCalledOnce();
  expect(request).not.toHaveBeenCalled();
});

it("retries only a confirmed pre-reservation warmup response", async () => {
  vi.useFakeTimers();
  request.mockRejectedValueOnce(
    new ApiError("Waking", "VOICE_WARMING", 503, true),
  );
  const voice = new GnaniVoice({
    sessionUrl: "/api/sessions/test/voice-session",
  });
  const started = voice.start();
  await flush();
  expect(request).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(3000);
  await flush();
  socket.onopen?.();
  ready();
  await started;
  expect(request).toHaveBeenCalledTimes(2);
  const stopped = voice.stop();
  await flush();
  socket.onmessage?.({
    data: JSON.stringify({ type: "ended", reason: "manual" }),
  });
  await stopped;
  vi.useRealTimers();
});

it("keeps the hosted listening connection active and stops pings on cleanup", async () => {
  vi.useFakeTimers();
  try {
    const voice = new GnaniVoice({
      sessionUrl: "/api/sessions/test/voice-session",
    });
    const started = voice.start();
    await flush();
    socket.onopen?.();
    ready();
    await started;
    send.mockClear();
    await vi.advanceTimersByTimeAsync(4000);
    expect(send.mock.calls).toEqual([
      [JSON.stringify({ type: "ping" })],
      [JSON.stringify({ type: "ping" })],
    ]);
    const stopped = voice.stop();
    await flush();
    socket.onmessage?.({
      data: JSON.stringify({ type: "ended", reason: "manual" }),
    });
    await stopped;
    send.mockClear();
    await vi.advanceTimersByTimeAsync(4000);
    expect(send).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});

it("preserves audio through brief upload backpressure and still bounds the client queue", async () => {
  const voice = new GnaniVoice({
    sessionUrl: "/api/sessions/test/voice-session",
  });
  const started = voice.start();
  await flush();
  socket.onopen?.();
  ready();
  await started;
  send.mockClear();
  socket.bufferedAmount = 64000;
  const frame = new Uint8Array(1024);
  capturePort.onmessage?.({ data: frame });
  expect(send).toHaveBeenCalledWith(frame);
  expect(voice.getState()).toBe("active");
  socket.bufferedAmount = 128 * 1024 + 1;
  capturePort.onmessage?.({ data: frame });
  await flush();
  expect(voice.getState()).toBe("ended");
  expect(stopTrack).toHaveBeenCalledOnce();
});
