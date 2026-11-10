import "server-only";
import { resolveReasoning } from "../reasoning-config.mjs";
export function authConfigured() {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}
export function emailVerificationRequired() {
  return process.env.AUTH_EMAIL_VERIFICATION_REQUIRED !== "false";
}
export function required(name: string) {
  const v = process.env[name];
  if (!v) throw new Error("CONFIGURATION");
  return v;
}

export function scoringConfigured() {
  try {
    reasoningConfig();
    return true;
  } catch {
    return false;
  }
}

export function reasoningConfig() {
  return resolveReasoning(process.env);
}

export function gnaniConfigured() {
  try {
    voiceConfig();
    return true;
  } catch {
    return false;
  }
}

export function samvaadConfigured() {
  return (
    authConfigured() &&
    !!process.env.SUPABASE_SECRET_KEY &&
    !!process.env.APP_ORIGIN &&
    gnaniConfigured() &&
    scoringConfigured()
  );
}

export function maxSessionDuration(): 180 | 300 {
  const raw = process.env.MAX_SESSION_DURATION_SECONDS;
  if (!raw) return 300;
  const value = Number(raw);
  if (value !== 180 && value !== 300) throw new Error("CONFIGURATION");
  return value;
}

export function dailySessionLimit() {
  const raw = process.env.MAX_DAILY_SESSIONS_PER_USER;
  if (!raw) return 10;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new Error("CONFIGURATION");
  }
  return value;
}

export function secureBase(name: string, fallback?: string) {
  try {
    const url = new URL(process.env[name] || fallback || required(name));
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error();
    return url.toString().replace(/\/$/, "");
  } catch {
    throw new Error("CONFIGURATION");
  }
}

export function voiceConfig(_duration?: 180 | 300, _mode?: string) {
  if (_duration && _duration > maxSessionDuration())
    throw new Error("CONFIGURATION");
  if (
    _mode &&
    ![
      "interview",
      "viva",
      "debate",
      "group_discussion",
      "presentation",
    ].includes(_mode)
  )
    throw new Error("CONFIGURATION");
  if (process.env.VOICE_RUNTIME_ENABLED !== "true")
    throw new Error("CONFIGURATION");
  required("GNANI_SPEECH_API_KEY");
  const url = new URL(required("SAMVAAD_VOICE_WS_URL"));
  const app = new URL(required("APP_ORIGIN"));
  const local =
    app.protocol === "http:" &&
    ["127.0.0.1", "localhost", "[::1]"].includes(app.hostname) &&
    ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "wss:" && !(local && url.protocol === "ws:")) ||
    url.pathname !== "/speech" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("CONFIGURATION");
  return { websocketUrl: url.toString() };
}

export function monthlyVoiceMinutes() {
  const value = Number(process.env.MAX_MONTHLY_VOICE_MINUTES || "30");
  if (!Number.isInteger(value) || value < 1 || value > 10000)
    throw new Error("CONFIGURATION");
  return value;
}
