import { expect, it, vi } from "vitest";
import { speechStorageRequest } from "../src/lib/voice/storage-retry";
const failure = {
  data: null,
  error: { message: "private failure" },
  status: 0,
};
const success = { data: {}, error: null, status: 200 };
it.each(["student", "delivery", "heartbeat"])(
  "retries exactly once for replay-safe %s",
  async (action) => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(failure)
      .mockResolvedValueOnce(success);
    expect(
      await speechStorageRequest("speech_event", { p_action: action }, request),
    ).toEqual(success);
    expect(request).toHaveBeenCalledTimes(2);
  },
);
it.each(["assistant", "complete", "ready", "drain"])(
  "never retries uncertain %s writes",
  async (action) => {
    const request = vi.fn().mockResolvedValue(failure);
    await speechStorageRequest("speech_event", { p_action: action }, request);
    expect(request).toHaveBeenCalledOnce();
  },
);
it.each(["consume_speech_grant", "reserve_speech", "start_speech"])(
  "never retries %s",
  async (name) => {
    const request = vi.fn().mockResolvedValue(failure);
    await speechStorageRequest(name, {}, request);
    expect(request).toHaveBeenCalledOnce();
  },
);
it("does not retry semantic validation errors and bounds persistent transport failure", async () => {
  const semantic = vi.fn().mockResolvedValue({ ...failure, status: 400 });
  await speechStorageRequest("speech_event", { p_action: "student" }, semantic);
  expect(semantic).toHaveBeenCalledOnce();
  const network = vi.fn().mockResolvedValue(failure);
  await speechStorageRequest("speech_event", { p_action: "student" }, network);
  expect(network).toHaveBeenCalledTimes(2);
});
