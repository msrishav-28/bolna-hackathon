import { afterEach, describe, expect, it, vi } from "vitest";
import {
  gnaniConfigured,
  samvaadConfigured,
  dailySessionLimit,
  maxSessionDuration,
  scoringConfigured,
} from "../src/lib/server/config";

const complete = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable",
  SUPABASE_SECRET_KEY: "secret",
  APP_ORIGIN: "http://127.0.0.1:3000",
  GNANI_SPEECH_API_KEY: "gnani-key",
  SAMVAAD_VOICE_WS_URL: "wss://voice.example.test/speech",
  VOICE_RUNTIME_ENABLED: "true",
  REASONING_BASE_URL: "https://reasoning.example/v1",
  REASONING_API_KEY: "reasoning-key",
  REASONING_MODEL: "model",
};

function setEnv(values: Record<string, string | undefined>) {
  for (const [name, value] of Object.entries(values)) {
    vi.stubEnv(name, value as string);
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Samvaad configuration", () => {
  it("fails closed when any required service value is missing", () => {
    setEnv(complete);
    expect(samvaadConfigured()).toBe(true);
    for (const name of [
      "SUPABASE_SECRET_KEY",
      "GNANI_SPEECH_API_KEY",
      "SAMVAAD_VOICE_WS_URL",
      "VOICE_RUNTIME_ENABLED",
      "REASONING_API_KEY",
      "APP_ORIGIN",
    ]) {
      setEnv({ ...complete, [name]: undefined });
      expect(samvaadConfigured(), name).toBe(false);
    }
  });

  it("requires an explicit runtime switch and TLS outside loopback", () => {
    setEnv({
      ...complete,
      SAMVAAD_VOICE_WS_URL: "ws://public.example.test/speech",
    });
    expect(gnaniConfigured()).toBe(false);
    setEnv(complete);
    expect(gnaniConfigured()).toBe(true);
  });

  it("requires every scoring value", () => {
    setEnv(complete);
    expect(scoringConfigured()).toBe(true);
    for (const name of [
      "REASONING_BASE_URL",
      "REASONING_API_KEY",
      "REASONING_MODEL",
    ]) {
      setEnv({ ...complete, [name]: undefined });
      expect(scoringConfigured(), name).toBe(false);
    }
  });

  it("accepts only supported session durations", () => {
    setEnv({ MAX_SESSION_DURATION_SECONDS: undefined });
    expect(maxSessionDuration()).toBe(300);
    setEnv({ MAX_SESSION_DURATION_SECONDS: "180" });
    expect(maxSessionDuration()).toBe(180);
    setEnv({ MAX_SESSION_DURATION_SECONDS: "300" });
    expect(maxSessionDuration()).toBe(300);
    for (const invalid of ["240", "0", "abc", "300.5"]) {
      setEnv({ MAX_SESSION_DURATION_SECONDS: invalid });
      expect(() => maxSessionDuration(), invalid).toThrow("CONFIGURATION");
    }
  });

  it("accepts only a bounded integer daily session limit", () => {
    setEnv({ MAX_DAILY_SESSIONS_PER_USER: undefined });
    expect(dailySessionLimit()).toBe(10);
    setEnv({ MAX_DAILY_SESSIONS_PER_USER: "5" });
    expect(dailySessionLimit()).toBe(5);
    for (const invalid of ["0", "101", "1.5", "abc"]) {
      setEnv({ MAX_DAILY_SESSIONS_PER_USER: invalid });
      expect(() => dailySessionLimit(), invalid).toThrow("CONFIGURATION");
    }
  });
});
