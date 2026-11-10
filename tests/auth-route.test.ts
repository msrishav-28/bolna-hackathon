import { afterEach, describe, expect, it, vi } from "vitest";

const reset = vi.hoisted(() => vi.fn());
const signup = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/server/supabase", () => ({
  authClient: async () => ({
    auth: { resetPasswordForEmail: reset, signUp: signup },
  }),
}));
import { POST } from "../src/app/api/auth/route";

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});

describe("password reset delivery", () => {
  async function request() {
    vi.stubEnv("APP_ORIGIN", "http://127.0.0.1:3000");
    return POST(
      new Request("http://127.0.0.1:3000/api/auth", {
        method: "POST",
        headers: { origin: "http://127.0.0.1:3000" },
        body: JSON.stringify({
          action: "reset",
          email: "student@example.test",
        }),
      }),
    );
  }

  it("reports provider failure without exposing provider details", async () => {
    reset.mockResolvedValue({ error: { message: "private provider detail" } });
    const response = await request();
    expect(response.status).toBe(400);
    const body = await response.text();
    expect(body).toContain('"code":"AUTH"');
    expect(body).not.toContain("private provider detail");
  });

  it("keeps successful responses neutral about whether an account exists", async () => {
    reset.mockResolvedValue({ error: null });
    const response = await request();
    expect(response.status).toBe(200);
    expect((await response.json()).message).toContain("If the account");
    expect(reset).toHaveBeenCalledWith("student@example.test", {
      redirectTo:
        "http://127.0.0.1:3000/auth/callback?next=%2Fauth%3Fflow%3Dupdate",
    });
  });
  it("blocks email recovery when the selected password-only policy has no mail service", async () => {
    vi.stubEnv("AUTH_EMAIL_VERIFICATION_REQUIRED", "false");
    const response = await request();
    expect(response.status).toBe(409);
    expect(reset).not.toHaveBeenCalled();
    expect(await response.text()).toContain("EMAIL_RECOVERY_UNAVAILABLE");
  });
  it.each([true, false])(
    "password-only signup requires a real authenticated session: %s",
    async (hasSession) => {
      vi.stubEnv("APP_ORIGIN", "http://127.0.0.1:3000");
      vi.stubEnv("AUTH_EMAIL_VERIFICATION_REQUIRED", "false");
      signup.mockResolvedValue({
        error: null,
        data: { session: hasSession ? { access_token: "synthetic" } : null },
      });
      const response = await POST(
        new Request("http://127.0.0.1:3000/api/auth", {
          method: "POST",
          headers: { origin: "http://127.0.0.1:3000" },
          body: JSON.stringify({
            action: "signup",
            email: "synthetic@example.test",
            password: "synthetic-password",
            next: "/practice",
          }),
        }),
      );
      expect(response.status).toBe(hasSession ? 200 : 400);
      const body = await response.text();
      expect(body).not.toContain("synthetic");
      expect(body).not.toContain("verify your email");
      if (hasSession)
        expect(JSON.parse(body)).toEqual({ message: "", next: "/practice" });
    },
  );
});
