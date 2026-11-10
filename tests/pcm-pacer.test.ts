import { afterEach, expect, it, vi } from "vitest";
import { startPcmPacer } from "../src/lib/voice/pcm-pacer";
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
it("maintains real-time frame count despite recurring timer lateness", async () => {
  vi.useFakeTimers({ toFake: ["performance", "setTimeout", "clearTimeout"] });
  const schedule = globalThis.setTimeout;
  vi.spyOn(globalThis, "setTimeout").mockImplementation(((
    callback: () => void,
    delay: number,
  ) => schedule(callback, delay + 4)) as typeof setTimeout);
  const send = vi.fn(),
    failure = vi.fn(),
    stop = startPcmPacer(send, failure);
  await vi.advanceTimersByTimeAsync(15000);
  stop();
  expect(send.mock.calls.length).toBeGreaterThanOrEqual(467);
  expect(send.mock.calls.length).toBeLessThanOrEqual(469);
  expect(failure).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1000);
  expect(send.mock.calls.length).toBeLessThanOrEqual(469);
});
it("fails a stalled pacer without bursting stale frames", async () => {
  vi.useFakeTimers({ toFake: ["performance", "setTimeout", "clearTimeout"] });
  const schedule = globalThis.setTimeout;
  vi.spyOn(globalThis, "setTimeout").mockImplementationOnce(((
    callback: () => void,
    delay: number,
  ) => schedule(callback, delay + 1000)) as typeof setTimeout);
  const send = vi.fn(),
    failure = vi.fn();
  startPcmPacer(send, failure);
  await vi.advanceTimersByTimeAsync(3000);
  expect(send).not.toHaveBeenCalled();
  expect(failure).toHaveBeenCalledOnce();
});
