import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  topics: vi.fn(),
  history: vi.fn(),
  owned: vi.fn(),
  create: vi.fn(),
  voice: vi.fn(),
  complete: vi.fn(),
  process: vi.fn(),
  after: vi.fn(),
}));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("../src/lib/server/supabase", () => ({
  authClient: async () => ({ auth: { getUser: mocks.user } }),
}));
vi.mock("../src/lib/server/sessions", () => ({
  topics: mocks.topics,
  history: mocks.history,
  ownedSession: mocks.owned,
  createSession: mocks.create,
}));
vi.mock("../src/lib/server/workflow", () => ({
  openVoice: mocks.voice,
  requestCompletion: mocks.complete,
  processSession: mocks.process,
}));
import { GET, POST } from "../src/app/api/[...product]/route";
import { AppError } from "../src/lib/server/http";
const id = "30000000-0000-4000-8000-000000000001";
const topic = "30000000-0000-4000-8000-000000000002";
const context = (...product: string[]) => ({
  params: Promise.resolve({ product }),
});
const get = (path: string) => new Request(`http://127.0.0.1:3000/api/${path}`);
const post = (
  path: string,
  body: unknown = {},
  origin = "http://127.0.0.1:3000",
) =>
  new Request(`http://127.0.0.1:3000/api/${path}`, {
    method: "POST",
    headers: { origin, "Idempotency-Key": id },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("APP_ORIGIN", "http://127.0.0.1:3000");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic");
  mocks.user.mockResolvedValue({
    data: { user: { id, email_confirmed_at: "2026-10-28T00:00:00Z" } },
    error: null,
  });
  mocks.owned.mockResolvedValue({ id, status: "processing" });
  mocks.complete.mockResolvedValue({ id, status: "processing" });
});
afterEach(() => vi.unstubAllEnvs());
describe("product HTTP boundaries", () => {
  it.each(
    [0, 503].flatMap((status) => [
      { status, cachedIdentity: false },
      { status, cachedIdentity: true },
    ]),
  )(
    "denies a temporary auth failure as retryable service unavailability: %j",
    async ({ status, cachedIdentity }) => {
      mocks.user.mockResolvedValue({
        data: { user: cachedIdentity ? { id } : null },
        error: new AuthRetryableFetchError("private transport detail", status),
      });
      const response = await GET(
        get(`sessions/${id}`),
        context("sessions", id),
      );
      expect(response.status).toBe(503);
      const body = await response.text();
      expect(JSON.parse(body).error).toMatchObject({
        code: "SERVICE_UNAVAILABLE",
        retryable: true,
      });
      expect(body).not.toContain("private transport detail");
      expect(mocks.owned).not.toHaveBeenCalled();
    },
  );
  it("keeps a rejected auth token unauthenticated without a retryable response", async () => {
    mocks.user.mockResolvedValue({
      data: { user: null },
      error: new AuthApiError("private invalid token", 401, "bad_jwt"),
    });
    const response = await GET(get(`sessions/${id}`), context("sessions", id));
    expect(response.status).toBe(401);
    expect((await response.json()).error).toMatchObject({
      code: "UNAUTHENTICATED",
      retryable: false,
    });
    expect(mocks.owned).not.toHaveBeenCalled();
  });
  it("allows public topics and applies private no-store headers", async () => {
    mocks.topics.mockResolvedValue({ topics: [] });
    const response = await GET(get("topics"), context("topics"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.user).not.toHaveBeenCalled();
  });
  it("requires confirmed identity for all session actions", async () => {
    mocks.user.mockResolvedValue({ data: { user: null }, error: null });
    expect((await GET(get("sessions"), context("sessions"))).status).toBe(401);
    expect(
      (
        await POST(
          post(`sessions/${id}/voice-session`),
          context("sessions", id, "voice-session"),
        )
      ).status,
    ).toBe(401);
    expect(mocks.voice).not.toHaveBeenCalled();
    mocks.user.mockResolvedValue({ data: { user: { id } }, error: null });
    expect(
      (await GET(get(`sessions/${id}`), context("sessions", id))).status,
    ).toBe(403);
  });
  it("validates setup and passes the authenticated owner, not a body identity", async () => {
    const body = {
      topicId: topic,
      difficulty: "standard",
      durationSeconds: 180,
    };
    mocks.create.mockResolvedValue({ id, status: "created" });
    const response = await POST(post("sessions", body), context("sessions"));
    expect(response.status).toBe(200);
    expect(mocks.create).toHaveBeenCalledWith(id, body, id);
    expect(
      (
        await POST(
          post("sessions", { ...body, userId: topic }),
          context("sessions"),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await POST(
          post("sessions", { ...body, durationSeconds: 999 }),
          context("sessions"),
        )
      ).status,
    ).toBe(400);
  });
  it("rejects foreign origins before calling services", async () => {
    const response = await POST(
      post(`sessions/${id}/complete`, {}, "https://attacker.example.test"),
      context("sessions", id, "complete"),
    );
    expect(response.status).toBe(403);
    expect(mocks.complete).not.toHaveBeenCalled();
  });
  it("refuses client-supplied transcript, result and provider identifiers", async () => {
    const response = await POST(
      post(`sessions/${id}/complete`, {
        providerExecutionId: "fake",
        transcript: "fake",
      }),
      context("sessions", id, "complete"),
    );
    expect(response.status).toBe(400);
    expect(mocks.complete).not.toHaveBeenCalled();
  });
  it("schedules processing after returning persisted completion state", async () => {
    const response = await POST(
      post(`sessions/${id}/complete`),
      context("sessions", id, "complete"),
    );
    expect(response.status).toBe(200);
    expect(mocks.complete).toHaveBeenCalledWith(id, id);
    expect(mocks.after).toHaveBeenCalledOnce();
    await mocks.after.mock.calls[0][0]();
    expect(mocks.process).toHaveBeenCalledWith(id);
  });
  it("never schedules foreign or missing sessions", async () => {
    mocks.owned.mockRejectedValue(new AppError("SESSION_NOT_FOUND", 404));
    expect(
      (await GET(get(`sessions/${id}`), context("sessions", id))).status,
    ).toBe(404);
    expect(mocks.after).not.toHaveBeenCalled();
  });
  it("returns the owned short-lived grant and rejects client context", async () => {
    const grant = {
      runId: id,
      grant: "a".repeat(43),
      websocketUrl: "wss://voice.example.test/speech",
      protocol: "samvaad-speech-v1",
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    };
    mocks.voice.mockResolvedValue(grant);
    const response = await POST(
      post(`sessions/${id}/voice-session`, {}),
      context("sessions", id, "voice-session"),
    );
    expect(await response.json()).toEqual(grant);
    expect(mocks.voice).toHaveBeenCalledWith(id, id);
    mocks.voice.mockClear();
    expect(
      (
        await POST(
          post(`sessions/${id}/voice-session`, { topic: "attacker" }),
          context("sessions", id, "voice-session"),
        )
      ).status,
    ).toBe(400);
    expect(mocks.voice).not.toHaveBeenCalled();
  });
  it("fails closed without configuration and rejects unknown paths", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect((await GET(get("topics"), context("topics"))).status).toBe(503);
    expect(
      (await GET(get("sessions/not-a-uuid"), context("sessions", "not-a-uuid")))
        .status,
    ).toBe(404);
  });
});
