// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { z } from "zod";
import { useProductResource } from "@/lib/client/use-product-resource";
import { ApiError } from "@/lib/client/api";
const request = vi.hoisted(() => vi.fn());
vi.mock("@/lib/client/product-api", () => ({ productRequest: request }));
const schema = z.object({ status: z.string() });
beforeEach(() => request.mockReset());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it("discards an old response after the resource path changes", async () => {
  let oldResolve!: (value: { status: string }) => void;
  request
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          oldResolve = resolve;
        }),
    )
    .mockResolvedValueOnce({ status: "new" });
  const { result, rerender } = renderHook(
    ({ path }) => useProductResource(path, schema),
    { initialProps: { path: "/old" } },
  );
  const signal = request.mock.calls[0][2].signal;
  rerender({ path: "/new" });
  await waitFor(() => expect(result.current.data?.status).toBe("new"));
  await act(async () => oldResolve({ status: "stale" }));
  expect(signal.aborted).toBe(true);
  expect(result.current.data?.status).toBe("new");
});
it("stops polling at a terminal result and aborts on unmount", async () => {
  vi.useFakeTimers();
  request
    .mockResolvedValueOnce({ status: "processing" })
    .mockResolvedValueOnce({ status: "completed" });
  const pending = (data: { status: string }) => data.status === "processing";
  const { result, unmount } = renderHook(() =>
    useProductResource("/round", schema, 4000, pending),
  );
  await act(async () => {});
  await act(async () => {
    await vi.advanceTimersByTimeAsync(4000);
  });
  expect(result.current.data?.status).toBe("completed");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(16000);
  });
  expect(request).toHaveBeenCalledTimes(2);
  unmount();
  expect(request.mock.calls[0][2].signal.aborted).toBe(true);
});
it("stops on error and retries only on request", async () => {
  vi.useFakeTimers();
  request
    .mockRejectedValueOnce(new ApiError("Sign in", "UNAUTHENTICATED"))
    .mockResolvedValue({ status: "completed" });
  const { result } = renderHook(() =>
    useProductResource("/round", schema, 4000),
  );
  await act(async () => {});
  await act(async () => {
    await vi.advanceTimersByTimeAsync(12000);
  });
  expect(request).toHaveBeenCalledTimes(1);
  expect(result.current.error?.code).toBe("UNAUTHENTICATED");
  await act(async () => result.current.retry());
  expect(result.current.data?.status).toBe("completed");
});

it("recovers transient status polling without clearing the last known session", async () => {
  vi.useFakeTimers();
  request
    .mockResolvedValueOnce({ status: "processing" })
    .mockRejectedValueOnce(new ApiError("temporary", "NETWORK"))
    .mockResolvedValueOnce({ status: "completed" });
  const pending = (data: { status: string }) => data.status !== "completed";
  const { result } = renderHook(() =>
    useProductResource("/round", schema, 4000, pending),
  );
  await act(async () => {});
  await act(async () => {
    await vi.advanceTimersByTimeAsync(4000);
  });
  expect(result.current.data?.status).toBe("processing");
  expect(result.current.error).toBeNull();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(4000);
  });
  expect(result.current.data?.status).toBe("completed");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(12000);
  });
  expect(request).toHaveBeenCalledTimes(3);
});
it("bounds consecutive transport failures to three read attempts", async () => {
  vi.useFakeTimers();
  request.mockImplementation(async () => {
    throw new ApiError("temporary", "NETWORK");
  });
  const { result } = renderHook(() =>
    useProductResource("/round", schema, 4000),
  );
  await act(async () => {});
  for (let n = 0; n < 5; n++) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
  }
  expect(request).toHaveBeenCalledTimes(3);
  expect(result.current.error?.code).toBe("NETWORK");
  request.mockResolvedValue({ status: "completed" });
  await act(async () => result.current.retry());
  expect(result.current.data?.status).toBe("completed");
});
