// @vitest-environment jsdom
import { createElement } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Setup } from "@/components/product/setup";
import { MicrophoneCheck } from "@/components/product/microphone-check";
import { previewTopics, previewSession } from "@/lib/server/preview-data";
import { ApiError } from "@/lib/client/api";
const mocks = vi.hoisted(() => ({ request: vi.fn(), push: vi.fn() }));
vi.mock("@/lib/client/product-api", () => ({ productRequest: mocks.request }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("retains the creation key on retries and changes it for a different setup", async () => {
  mocks.request.mockImplementation((path: string) =>
    path === "/api/practice-options"
      ? Promise.resolve({
          contractVersion: 1,
          quota: null,
          modes: [
            {
              id: "group_discussion",
              label: "Group discussion",
              description: "Practice",
              available: true,
              unavailableReason: null,
              topics: previewTopics,
              durations: [180, 300],
              rubricVersion: "gd-legacy-v1",
            },
          ],
        })
      : Promise.reject(new ApiError("Try again", "NETWORK")),
  );
  render(createElement(Setup));
  const topic = await screen.findByRole("radio", {
    name: /Should colleges allow AI/,
  });
  fireEvent.click(topic);
  const submit = screen.getByRole("button", { name: /Check your microphone/ });
  fireEvent.click(submit);
  await screen.findByRole("alert");
  fireEvent.click(submit);
  await waitFor(() =>
    expect(
      mocks.request.mock.calls.filter((call) => call[0] === "/api/sessions"),
    ).toHaveLength(2),
  );
  const calls = mocks.request.mock.calls.filter(
    (call) => call[0] === "/api/sessions",
  );
  expect(calls[0][2].key).toBe(calls[1][2].key);
  await waitFor(() =>
    expect((submit as HTMLButtonElement).disabled).toBe(false),
  );
  fireEvent.click(screen.getByRole("radio", { name: "5 minutes" }));
  fireEvent.click(submit);
  await waitFor(() =>
    expect(
      mocks.request.mock.calls.filter((call) => call[0] === "/api/sessions"),
    ).toHaveLength(3),
  );
  const third = mocks.request.mock.calls.filter(
    (call) => call[0] === "/api/sessions",
  )[2];
  expect(third[2].key).not.toBe(calls[0][2].key);
  expect(third[2].body.durationSeconds).toBe(300);
});
it("preview setup never sends a creation request", async () => {
  render(createElement(Setup, { sample: previewTopics }));
  fireEvent.click(
    screen.getByRole("radio", { name: /Should colleges allow AI/ }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: /Check your microphone/ }),
  );
  expect(mocks.request).not.toHaveBeenCalled();
  expect(mocks.push).toHaveBeenCalledWith(
    expect.stringContaining("screen=check"),
  );
});
it("keeps entry disabled after microphone permission is denied", async () => {
  const getUserMedia = vi
    .fn()
    .mockRejectedValue(new DOMException("Denied", "NotAllowedError"));
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  render(createElement(MicrophoneCheck, { session: previewSession }));
  expect(getUserMedia).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Test microphone" }));
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toContain("blocked"),
  );
  expect(
    (
      screen.getByRole("button", {
        name: /Enter practice room/,
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
});
it("releases a microphone granted after leaving the screen", async () => {
  let grant!: (media: unknown) => void;
  const stop = vi.fn();
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: () =>
        new Promise((resolve) => {
          grant = resolve;
        }),
    },
  });
  const { unmount } = render(
    createElement(MicrophoneCheck, { session: previewSession }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Test microphone" }));
  unmount();
  await act(async () => grant({ getTracks: () => [{ stop }] }));
  expect(stop).toHaveBeenCalledOnce();
});
it("stops the microphone test and rejects a silent input", async () => {
  vi.useFakeTimers();
  const stop = vi.fn();
  const close = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }),
    },
  });
  vi.stubGlobal(
    "AudioContext",
    class {
      resume = async () => {};
      close = close;
      createMediaStreamSource = () => ({ connect: vi.fn() });
      createAnalyser = () => ({
        fftSize: 256,
        getByteTimeDomainData: (values: Uint8Array) => values.fill(128),
      });
    },
  );
  render(createElement(MicrophoneCheck, { session: previewSession }));
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Test microphone" })),
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(4000);
  });
  expect(stop).toHaveBeenCalledOnce();
  expect(close).toHaveBeenCalledOnce();
  expect(screen.getByRole("status").textContent).toContain("couldn’t hear");
});
