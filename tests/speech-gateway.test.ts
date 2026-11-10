import { EventEmitter } from "node:events";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import type WebSocket from "ws";
const mocks = vi.hoisted(() => ({
  instances: [] as unknown[],
  synth: vi.fn(),
  reply: vi.fn(),
}));
vi.mock("../src/lib/voice/gnani-speech.js", () => ({
  GnaniRecognition: class {
    ready = Promise.resolve();
    requestIdentity = "request";
    send = vi.fn();
    close = vi.fn();
    finals: unknown[] = [];
    constructor(
      public key: string,
      public handlers: {
        onSpeechStart: (id: string) => void;
        onFinal: (segment: unknown) => void;
        onFailure: () => void;
      },
    ) {
      mocks.instances.push(this);
    }
    finish = async () => this.finals;
  },
  synthesizeSpeech: mocks.synth,
}));
vi.mock("../src/lib/voice/dialogue.js", () => ({
  conversationReply: mocks.reply,
  nextActor: () => "peer_a",
  voiceFor: () => "Shivani",
}));
import { SpeechConnection } from "../src/lib/voice/gateway";
import { SpeechStorageUnavailableError } from "../src/lib/voice/storage-retry";
class Socket extends EventEmitter {
  readyState = 1;
  bufferedAmount = 0;
  messages: Record<string, unknown>[] = [];
  send(raw: string) {
    this.messages.push(JSON.parse(raw));
  }
  close() {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.emit("close");
  }
  control(value: unknown) {
    this.emit("message", Buffer.from(JSON.stringify(value)), false);
  }
}
type Recognition = {
  handlers: {
    onSpeechStart: (id: string) => void;
    onFinal: (segment: unknown) => void;
    onFailure: () => void;
  };
  finals: unknown[];
  send: ReturnType<typeof vi.fn>;
};
const run = "30000000-0000-4000-8000-000000000003";
type Rpc = (name: string, args: Record<string, unknown>) => Promise<unknown>;
let socket: Socket,
  rpc: ReturnType<typeof vi.fn<Rpc>>,
  connection: SpeechConnection;
const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      "Date",
      "performance",
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
    ],
  });
  mocks.instances.length = 0;
  mocks.reply
    .mockReset()
    .mockResolvedValue("What reason supports that synthetic view?");
  mocks.synth
    .mockReset()
    .mockImplementation(async (_key, _text, _voice, _signal, onAudio) =>
      onAudio(Buffer.alloc(1024)),
    );
  socket = new Socket();
  rpc = vi.fn<Rpc>(async (name: string, args: Record<string, unknown>) =>
    name === "consume_speech_grant"
      ? {
          runId: run,
          sessionId: run,
          mode: "group_discussion",
          topic: "Synthetic practice topic",
          difficulty: "standard",
          durationSeconds: 180,
          startedAt: new Date().toISOString(),
          deadline: new Date(Date.now() + 180000).toISOString(),
        }
      : name === "start_speech"
        ? {
            startedAt: new Date().toISOString(),
            deadline: new Date(Date.now() + 180000).toISOString(),
          }
        : args.p_action === "assistant"
          ? { id: 1 }
          : {},
  );
  connection = new SpeechConnection(
    socket as unknown as WebSocket,
    { rpc },
    "synthetic-key",
  );
});
afterEach(async () => {
  await connection.fail();
  vi.useRealTimers();
});
async function open() {
  socket.control({
    type: "authenticate",
    grant: "a".repeat(43),
    protocol: "samvaad-speech-v1",
  });
  await flush();
  return mocks.instances[0] as Recognition;
}
it("consumes a hashed grant before opening providers and rejects grant replay", async () => {
  await open();
  expect(rpc.mock.calls[0][0]).toBe("consume_speech_grant");
  expect(rpc.mock.calls[0][1]).toMatchObject({
    p_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
  });
  expect(JSON.stringify(rpc.mock.calls)).not.toContain("a".repeat(43));
  expect(socket.messages.some((m) => m.type === "ready")).toBe(true);
  socket.control({
    type: "authenticate",
    grant: "a".repeat(43),
    protocol: "samvaad-speech-v1",
  });
  await flush();
  expect(socket.readyState).toBe(3);
});
it("times out unauthenticated sockets without a provider connection", async () => {
  await vi.advanceTimersByTimeAsync(5000);
  expect(socket.readyState).toBe(3);
  expect(mocks.instances).toHaveLength(0);
  expect(rpc).not.toHaveBeenCalled();
});
it("gives authenticated initialization its separate bounded connection window", async () => {
  const original = rpc.getMockImplementation()!;
  rpc.mockImplementation(async (name, args) => {
    if (name === "consume_speech_grant")
      await new Promise((resolve) => setTimeout(resolve, 6000));
    return original(name, args);
  });
  socket.control({
    type: "authenticate",
    grant: "a".repeat(43),
    protocol: "samvaad-speech-v1",
  });
  await vi.advanceTimersByTimeAsync(5500);
  expect(socket.readyState).toBe(1);
  await vi.advanceTimersByTimeAsync(500);
  await flush();
  expect(socket.messages.some((m) => m.type === "ready")).toBe(true);
});

it("caps AI audio and excludes a budget-interrupted turn without failing the round", async () => {
  mocks.synth.mockImplementation(
    async (_key, _text, _voice, _signal, onAudio) => {
      for (let n = 0; n < 20; n++) onAudio(Buffer.alloc(160000));
    },
  );
  await open();
  await flush();
  expect(socket.readyState).toBe(1);
  expect(
    rpc.mock.calls.some(
      ([, args]) =>
        args.p_action === "delivery" &&
        (args.p_data as { state: string }).state === "interrupted",
    ),
  ).toBe(true);
  const sentBytes = socket.messages
    .filter((m) => m.type === "audio")
    .reduce((sum, m) => sum + Buffer.from(m.pcm as string, "base64").length, 0);
  expect(sentBytes).toBeLessThanOrEqual(180 * 32000 * 0.35);
});
it("rejects browser-authored transcript/control fields", async () => {
  await open();
  socket.control({ type: "end", transcript: "Invented student evidence" });
  await flush();
  expect(socket.readyState).toBe(3);
  expect(rpc.mock.calls.some(([, args]) => args.p_action === "student")).toBe(
    false,
  );
});
it("paces exact binary frames and rejects malformed audio", async () => {
  const recognition = await open();
  socket.emit("message", Buffer.alloc(1024), true);
  expect(recognition.send).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(32);
  expect(recognition.send).toHaveBeenCalledOnce();
  socket.emit("message", Buffer.alloc(100), true);
  await flush();
  expect(socket.readyState).toBe(3);
});
it("preserves a delayed hosted-network burst at provider cadence", async () => {
  const recognition = await open();
  await vi.advanceTimersByTimeAsync(6000);
  recognition.send.mockClear();
  for (let frame = 0; frame < 160; frame++)
    socket.emit("message", Buffer.alloc(1024, frame + 1), true);
  expect(socket.readyState).toBe(1);
  expect(recognition.send).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(5120);
  expect(recognition.send).toHaveBeenCalledTimes(160);
  expect(recognition.send.mock.calls.map(([frame]) => frame[0])).toEqual(
    Array.from({ length: 160 }, (_, index) => index + 1),
  );
  expect(socket.readyState).toBe(1);
});
it("still rejects sustained input beyond the bounded hosted jitter buffer", async () => {
  await open();
  await vi.advanceTimersByTimeAsync(14000);
  socket.emit("message", Buffer.alloc(1024), true);
  await vi.advanceTimersByTimeAsync(4000);
  for (let frame = 0; frame < 513; frame++)
    socket.emit("message", Buffer.alloc(1024), true);
  await flush();
  expect(socket.readyState).toBe(3);
});
it("tolerates a short network interruption but rejects a lost capture stream", async () => {
  await open();
  await vi.advanceTimersByTimeAsync(14000);
  expect(socket.readyState).toBe(1);
  await vi.advanceTimersByTimeAsync(2000);
  expect(socket.readyState).toBe(3);
});
it("still rejects audio uploaded faster than microphone time", async () => {
  await open();
  for (let frame = 0; frame < 32; frame++)
    socket.emit("message", Buffer.alloc(1024), true);
  await flush();
  expect(socket.readyState).toBe(3);
});
it("uses elapsed gateway time when the database wall clock is ahead", async () => {
  const original = rpc.getMockImplementation()!;
  rpc.mockImplementation(async (name, args) => {
    const result = await original(name, args);
    return name === "start_speech"
      ? {
          startedAt: new Date(Date.now() + 5000).toISOString(),
          deadline: new Date(Date.now() + 185000).toISOString(),
        }
      : result;
  });
  await open();
  expect(
    socket.messages.find((message) => message.type === "ready"),
  ).toMatchObject({
    remainingMilliseconds: 180000,
  });
  for (let frame = 0; frame < 100; frame++) {
    socket.emit("message", Buffer.alloc(1024), true);
    await vi.advanceTimersByTimeAsync(32);
  }
  expect(socket.readyState).toBe(1);
  expect(rpc.mock.calls.some(([, args]) => args.p_action === "fail")).toBe(
    false,
  );
});
it("persists reordered provider finals in order and finishes only after drain", async () => {
  const recognition = await open();
  const segment = (index: number) => ({
    type: "transcript",
    is_final: true,
    segment_id: `request-seg-${index}`,
    segment_index: index,
    utterance_id: `u-${index}`,
    text: `Synthetic student contribution number ${index}.`,
  });
  recognition.handlers.onFinal(segment(2));
  recognition.handlers.onFinal(segment(1));
  recognition.finals = [segment(1), segment(2)];
  await flush();
  const saved = rpc.mock.calls.filter(
    ([, args]) => args.p_action === "student",
  );
  expect(
    saved.map(([, args]) => (args.p_data as { index: number }).index),
  ).toEqual([1, 2]);
  const ended = connection.end("manual");
  await vi.advanceTimersByTimeAsync(1200);
  await ended;
  expect(rpc.mock.calls.some(([, args]) => args.p_action === "complete")).toBe(
    true,
  );
  expect(socket.messages).toContainEqual({ type: "ended", reason: "manual" });
});
it("student speech aborts the current generation and clears playback", async () => {
  const recognition = await open();
  recognition.handlers.onSpeechStart("u-1");
  expect(socket.messages.some((m) => m.type === "clear")).toBe(true);
  expect(socket.messages.at(-1)).toMatchObject({
    type: "state",
    state: "listening",
    actor: "student",
  });
});
it("connection loss fails evidence instead of finalizing a partial transcript", async () => {
  await open();
  socket.close();
  await flush();
  expect(rpc.mock.calls.some(([, args]) => args.p_action === "fail")).toBe(
    true,
  );
  expect(rpc.mock.calls.some(([, args]) => args.p_action === "complete")).toBe(
    false,
  );
});
it("persists an empty final without ending the round or asking a new question", async () => {
  const recognition = await open();
  const empty = {
    type: "transcript",
    is_final: true,
    segment_id: "request-seg-1",
    segment_index: 1,
    utterance_id: "noise",
    text: "",
  };
  recognition.handlers.onSpeechStart("noise");
  recognition.handlers.onFinal(empty);
  await flush();
  expect(socket.readyState).toBe(1);
  expect(
    rpc.mock.calls.find(([, args]) => args.p_action === "student")?.[1].p_data,
  ).toMatchObject({ index: 1, text: "", segmentId: "request-seg-1" });
  const microphone = setInterval(
    () => socket.emit("message", Buffer.alloc(1024), true),
    32,
  );
  await vi.advanceTimersByTimeAsync(26000);
  clearInterval(microphone);
  expect(mocks.reply).not.toHaveBeenCalled();
  expect(socket.readyState).toBe(1);
});
it("does not downgrade a sent turn after an uncertain delivery acknowledgement", async () => {
  const original = rpc.getMockImplementation()!;
  rpc.mockImplementation(async (name, args) => {
    if (
      args.p_action === "delivery" &&
      (args.p_data as { state: string }).state === "sent"
    )
      throw new Error("GATEWAY_STORAGE_FAILED");
    return original(name, args);
  });
  await open();
  await flush();
  expect(socket.readyState).toBe(3);
  expect(
    rpc.mock.calls
      .filter(([, args]) => args.p_action === "delivery")
      .map(([, args]) => (args.p_data as { state: string }).state),
  ).toEqual(["sent"]);
});

it("protects presentation delivery through pauses before allowing audience questions", async () => {
  const original = rpc.getMockImplementation()!;
  rpc.mockImplementation(async (name, args) => {
    const result = await original(name, args);
    return name === "consume_speech_grant"
      ? { ...(result as Record<string, unknown>), mode: "presentation" }
      : result;
  });
  const recognition = await open();
  recognition.handlers.onFinal({
    type: "transcript",
    is_final: true,
    segment_id: "request-seg-1",
    segment_index: 1,
    utterance_id: "u-1",
    text: "Synthetic presentation argument with supporting explanation.",
  });
  await flush();
  const microphone = setInterval(
    () => socket.emit("message", Buffer.alloc(1024), true),
    32,
  );
  await vi.advanceTimersByTimeAsync(119000);
  expect(mocks.reply).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1500);
  expect(mocks.reply).toHaveBeenCalledOnce();
  clearInterval(microphone);
});

it("recovers a transient heartbeat without poisoning later student evidence", async () => {
  const original = rpc.getMockImplementation()!;
  let heartbeats = 0;
  rpc.mockImplementation(async (name, args) => {
    if (args.p_action === "heartbeat" && ++heartbeats === 1)
      throw new SpeechStorageUnavailableError();
    return original(name, args);
  });
  const recognition = await open();
  const microphone = setInterval(
    () => socket.emit("message", Buffer.alloc(1024), true),
    32,
  );
  try {
    await vi.advanceTimersByTimeAsync(11000);
    expect(socket.readyState).toBe(1);
    recognition.handlers.onFinal({
      type: "transcript",
      is_final: true,
      segment_id: "request-seg-1",
      segment_index: 1,
      utterance_id: "u-1",
      text: "Synthetic evidence saved after a transient heartbeat failure.",
    });
    await flush();
    expect(rpc.mock.calls.some(([, args]) => args.p_action === "student")).toBe(
      true,
    );
    await vi.advanceTimersByTimeAsync(10000);
    expect(heartbeats).toBe(2);
    expect(socket.readyState).toBe(1);
  } finally {
    clearInterval(microphone);
  }
});

it("stops prolonged unconfirmed liveness before the database stale-run fence", async () => {
  const original = rpc.getMockImplementation()!;
  rpc.mockImplementation(async (name, args) => {
    if (args.p_action === "heartbeat")
      throw new SpeechStorageUnavailableError();
    return original(name, args);
  });
  await open();
  const microphone = setInterval(
    () => socket.emit("message", Buffer.alloc(1024), true),
    32,
  );
  try {
    await vi.advanceTimersByTimeAsync(29999);
    expect(socket.readyState).toBe(1);
    await vi.advanceTimersByTimeAsync(251);
    expect(socket.readyState).toBe(3);
    expect(
      rpc.mock.calls.some(([, args]) => args.p_action === "complete"),
    ).toBe(false);
  } finally {
    clearInterval(microphone);
  }
});

it("still fails immediately on a semantic heartbeat rejection", async () => {
  const original = rpc.getMockImplementation()!;
  rpc.mockImplementation(async (name, args) => {
    if (args.p_action === "heartbeat")
      throw new Error("GATEWAY_STORAGE_FAILED");
    return original(name, args);
  });
  await open();
  await vi.advanceTimersByTimeAsync(10000);
  expect(socket.readyState).toBe(3);
});

it("does not overlap heartbeat requests while a bounded RPC is pending", async () => {
  const original = rpc.getMockImplementation()!;
  let heartbeats = 0;
  rpc.mockImplementation(async (name, args) => {
    if (args.p_action === "heartbeat" && ++heartbeats === 1)
      await new Promise((resolve) => setTimeout(resolve, 15000));
    return original(name, args);
  });
  await open();
  const microphone = setInterval(
    () => socket.emit("message", Buffer.alloc(1024), true),
    32,
  );
  try {
    await vi.advanceTimersByTimeAsync(24000);
    expect(heartbeats).toBe(1);
    await vi.advanceTimersByTimeAsync(6500);
    expect(heartbeats).toBe(2);
    expect(socket.readyState).toBe(1);
  } finally {
    clearInterval(microphone);
  }
});

it("does not move confirmed student liveness backwards on a late heartbeat reply", async () => {
  const original = rpc.getMockImplementation()!;
  let heartbeats = 0;
  rpc.mockImplementation(async (name, args) => {
    if (args.p_action === "heartbeat") {
      if (++heartbeats !== 1) throw new SpeechStorageUnavailableError();
      await new Promise((resolve) => setTimeout(resolve, 15000));
    }
    return original(name, args);
  });
  const recognition = await open();
  const microphone = setInterval(
    () => socket.emit("message", Buffer.alloc(1024), true),
    32,
  );
  try {
    await vi.advanceTimersByTimeAsync(20000);
    recognition.handlers.onFinal({
      type: "transcript",
      is_final: true,
      segment_id: "request-seg-1",
      segment_index: 1,
      utterance_id: "u-1",
      text: "Synthetic evidence confirms that this owned run is still live.",
    });
    await flush();
    await vi.advanceTimersByTimeAsync(24000);
    expect(socket.readyState).toBe(1);
    await vi.advanceTimersByTimeAsync(6250);
    expect(socket.readyState).toBe(3);
  } finally {
    clearInterval(microphone);
  }
});
