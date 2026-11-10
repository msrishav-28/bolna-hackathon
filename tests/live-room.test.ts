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
import LiveRoom from "@/components/product/live-room";
import { previewSession } from "@/lib/server/preview-data";
const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  request: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  mute: vi.fn(),
  listeners: new Map<string, (arg?: unknown) => void>(),
  options: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/lib/client/product-api", () => ({ productRequest: mocks.request }));
vi.mock("@/lib/client/gnani-voice", () => ({
  GnaniVoice: class {
    constructor(options: unknown) {
      mocks.options(options);
    }
    on(name: string, listener: (arg?: unknown) => void) {
      mocks.listeners.set(name, listener);
    }
    start = mocks.start;
    stop = mocks.stop;
    setMuted = mocks.mute;
    getState() {
      return "active";
    }
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.listeners.clear();
  mocks.start.mockImplementation(async () => {
    mocks.listeners.get("call-start")?.({
      remainingMilliseconds: previewSession.durationSeconds * 1000,
      deadline: new Date(
        Date.now() + previewSession.durationSeconds * 1000,
      ).toISOString(),
    });
  });
  mocks.stop.mockResolvedValue(undefined);
  mocks.request.mockResolvedValue({ session: previewSession });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const session = {
  ...previewSession,
  status: "created" as const,
  scorecard: null,
  transcript: null,
  overallScore: null,
};
it("starts only after a gesture, mutes the SDK and cleans up on leave", async () => {
  const { unmount } = render(createElement(LiveRoom, { session }));
  expect(mocks.start).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /Start discussion/ }));
  expect(mocks.start).toHaveBeenCalledOnce();
  await screen.findByRole("button", { name: "Mute microphone" });
  expect(mocks.options).toHaveBeenCalledWith({
    sessionUrl: `/api/sessions/${session.id}/voice-session`,
    debug: false,
  });
  fireEvent.click(screen.getByRole("button", { name: "Mute microphone" }));
  expect(mocks.mute).toHaveBeenCalledWith(true);
  unmount();
  expect(mocks.stop).toHaveBeenCalled();
});
it("stops when offline and offers reconciliation without opening another call", async () => {
  render(createElement(LiveRoom, { session }));
  fireEvent.click(screen.getByRole("button", { name: /Start discussion/ }));
  await screen.findByRole("button", { name: "Mute microphone" });
  act(() => window.dispatchEvent(new Event("offline")));
  expect(screen.getByRole("alert").textContent).toContain("offline");
  expect(screen.queryByRole("button", { name: /Start discussion/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Check round status" }));
  await waitFor(() =>
    expect(mocks.push).toHaveBeenCalledWith(
      `/practice/session/${session.id}/processing`,
    ),
  );
  expect(mocks.start).toHaveBeenCalledOnce();
});
it("does not restart an already minted or active session after refresh", () => {
  render(
    createElement(LiveRoom, {
      session: { ...session, status: "awaiting_voice" },
    }),
  );
  expect(screen.queryByRole("button", { name: /Start discussion/ })).toBeNull();
  expect(screen.getByRole("link", { name: "Check round status" })).toBeTruthy();
  expect(mocks.start).not.toHaveBeenCalled();
});
it("a cancelled connection cannot later become an active room", async () => {
  let resolve!: () => void;
  mocks.start.mockImplementation(
    () =>
      new Promise<void>((r) => {
        resolve = r;
      }),
  );
  render(createElement(LiveRoom, { session }));
  fireEvent.click(screen.getByRole("button", { name: /Start discussion/ }));
  await waitFor(() => expect(mocks.start).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole("button", { name: "Cancel connection" }));
  await act(async () => {
    mocks.listeners.get("call-start")?.();
    resolve();
  });
  expect(screen.queryByRole("button", { name: "Mute microphone" })).toBeNull();
  expect(mocks.stop).toHaveBeenCalled();
});
it("synthetic preview does not instantiate or call the voice provider", () => {
  render(createElement(LiveRoom, { session: previewSession, preview: true }));
  fireEvent.click(screen.getByRole("button", { name: "Mute microphone" }));
  expect(mocks.options).not.toHaveBeenCalled();
  expect(mocks.request).not.toHaveBeenCalled();
});
