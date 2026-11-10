import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
afterEach(() => vi.unstubAllEnvs());
it.each([undefined, "false", "TRUE"])(
  "blocks preview before streaming when flag is %s",
  async (flag) => {
    vi.stubEnv("UI_PREVIEW_ENABLED", flag);
    const response = await proxy(
      new NextRequest("http://localhost/preview?screen=report"),
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.text()).not.toContain("scorecard");
  },
);
it("allows explicitly enabled local review without weakening other route auth", async () => {
  vi.stubEnv("UI_PREVIEW_ENABLED", "true");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  const response = await proxy(new NextRequest("http://localhost/preview"));
  expect(response.headers.get("x-middleware-next")).toBe("1");
});
