import { afterEach, expect, it, vi } from "vitest";
import { z } from "zod";
import { productRequest } from "@/lib/client/product-api";
const schema = z.object({ value: z.number() });
afterEach(() => vi.unstubAllGlobals());
it("rejects malformed success data instead of displaying a partial result", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ value: "wrong" })),
  );
  await expect(productRequest("/api/sessions", schema)).rejects.toMatchObject({
    code: "INVALID_RESPONSE",
  });
});
it("preserves an actionable server error", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { error: { code: "RATE_LIMITED", message: "Try tomorrow." } },
          { status: 429 },
        ),
      ),
  );
  await expect(productRequest("/api/sessions", schema)).rejects.toMatchObject({
    code: "RATE_LIMITED",
    message: "Try tomorrow.",
  });
});
it("sends the creation key and disables response caching", async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ value: 1 }));
  vi.stubGlobal("fetch", fetch);
  await productRequest("/api/sessions", schema, {
    body: { durationSeconds: 180 },
    key: "synthetic-key",
  });
  expect(fetch).toHaveBeenCalledWith(
    "/api/sessions",
    expect.objectContaining({
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "synthetic-key",
      },
      body: '{"durationSeconds":180}',
    }),
  );
});
