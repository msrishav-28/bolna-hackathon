import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, errorText, request } from "@/lib/client/api";
import { content } from "@/lib/content";

afterEach(() => vi.unstubAllGlobals());
describe("client request recovery", () => {
  it("does not expose browser network error details", () => {
    expect(errorText(new TypeError("Failed to fetch internal host"))).toBe(
      content.auth.networkError,
    );
    expect(errorText(new ApiError("Try signing in again.", "AUTH"))).toBe(
      "Try signing in again.",
    );
  });
  it("gives a retry message for a non-JSON service response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Unavailable", { status: 503 })),
    );
    await expect(request("/api/auth", {})).rejects.toThrow(
      content.auth.responseError,
    );
  });
});
