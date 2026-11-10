// Local configuration only: no requests, secret values or claims of live acceptance.
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  reasoningProfile,
  resolveReasoning,
} from "../src/lib/reasoning-config.mjs";

const APP_FIELDS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "APP_ORIGIN",
  "REASONING_BASE_URL",
  "REASONING_API_KEY",
  "REASONING_MODEL",
  "REASONING_PROVIDER_LABEL",
  "PRIVACY_CONTACT_EMAIL",
];

export function speechConfiguration(env) {
  let profile;
  let reasoningReady = false;
  try {
    profile = reasoningProfile(env);
    resolveReasoning(env);
    reasoningReady = true;
  } catch {
    /* Report only status below. */
  }
  const effective = { ...env };
  if (profile) {
    effective.REASONING_BASE_URL = profile.baseUrl;
    effective.REASONING_MODEL = profile.model;
    effective.REASONING_API_KEY = env[profile.keyName];
    effective.REASONING_PROVIDER_LABEL = profile.label;
  }
  const names = ["GNANI_SPEECH_API_KEY", ...APP_FIELDS];
  const checks = names.map((name) => {
    const value = effective[name];
    let status = typeof value === "string" && value.trim() ? "set" : "missing";
    if (status === "set" && (value !== value.trim() || /[\r\n]/.test(value)))
      status = "invalid";
    if (
      status === "set" &&
      ["APP_ORIGIN", "NEXT_PUBLIC_SUPABASE_URL", "REASONING_BASE_URL"].includes(
        name,
      )
    ) {
      try {
        const url = new URL(value);
        const localApp =
          name === "APP_ORIGIN" &&
          url.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
        if (
          (!localApp && url.protocol !== "https:") ||
          url.username ||
          url.password ||
          url.search ||
          url.hash
        )
          throw new Error();
        if (name === "APP_ORIGIN" && url.pathname !== "/") throw new Error();
      } catch {
        status = "invalid";
      }
    }
    return { name, status };
  });
  return {
    checks,
    reasoning: {
      provider: profile?.provider || "invalid",
      model: profile?.model || null,
      keyName: profile?.keyName || null,
      configured: reasoningReady,
    },
    speechCredentialReady: checks[0].status === "set",
    appPrerequisitesPresent:
      reasoningReady && checks.slice(1).every(({ status }) => status === "set"),
    fullBrowserSessionReady: false,
    pending: [
      "direct-runtime-migration-and-host-acceptance",
      "final-word-completeness-acceptance",
      "realtime-and-browser-acceptance",
      "account-spend-and-retention-checks",
    ],
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    if (existsSync(".env.local")) process.loadEnvFile(".env.local");
    const report = speechConfiguration(process.env);
    console.log(JSON.stringify(report, null, 2));
    console.log(
      "Local presence/shape check only; no provider calls or account verification. A ready Speech credential permits the opt-in REST probe, not a complete app session. Legacy Agent Builder credentials are not required for this check.",
    );
    process.exitCode = report.speechCredentialReady ? 0 : 1;
  } catch {
    console.error(
      "SPEECH_CONFIG_LOAD_FAILED: check .env.local syntax locally; no values printed.",
    );
    process.exitCode = 1;
  }
}
