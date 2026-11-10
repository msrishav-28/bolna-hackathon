import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it } from "vitest";
it.each([16000, 44100, 48000])(
  "frames and pads actual %iHz microphone data as 16kHz PCM",
  (rate) => {
    const messages: unknown[] = [];
    let Capture: new () => {
      process(inputs: Float32Array[][]): boolean;
      port: { onmessage: (event: { data: unknown }) => void };
    };
    class Processor {
      port = {
        postMessage: (value: unknown) => messages.push(value),
        onmessage: null,
      };
    }
    runInNewContext(readFileSync("public/audio/gnani-capture.js", "utf8"), {
      AudioWorkletProcessor: Processor,
      sampleRate: rate,
      registerProcessor: (_name: string, type: typeof Capture) => {
        Capture = type;
      },
      Uint8Array,
      DataView,
      Math,
    });
    const capture = new Capture!();
    let remaining = rate;
    while (remaining) {
      const count = Math.min(128, remaining);
      capture.process([[new Float32Array(count).fill(0.25)]]);
      remaining -= count;
    }
    capture.port.onmessage({ data: { type: "flush" } });
    const frames = messages.filter(
      (value) => value instanceof Uint8Array,
    ) as Uint8Array[];
    expect(frames).toHaveLength(32);
    expect(frames.every((frame) => frame.length === 1024)).toBe(true);
    expect(new DataView(frames[0].buffer).getInt16(0, true)).toBe(8192);
    const last = new DataView(frames.at(-1)!.buffer);
    expect(last.getInt16(254, true)).toBe(8192);
    expect(last.getInt16(256, true)).toBe(0);
    expect(messages.at(-1)).toEqual({ type: "flushed" });
  },
);
