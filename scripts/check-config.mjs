import { existsSync } from "node:fs";
import { speechConfiguration } from "./check-speech-config.mjs";

// Selected-route configuration only. No provider requests or raw values in output.
try {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const report = speechConfiguration(process.env);
  const limits = [
    ["MAX_SESSION_DURATION_SECONDS", 300, (n) => [180, 300].includes(n)],
    [
      "MAX_DAILY_SESSIONS_PER_USER",
      10,
      (n) => Number.isInteger(n) && n >= 1 && n <= 100,
    ],
    [
      "MAX_MONTHLY_VOICE_MINUTES",
      30,
      (n) => Number.isInteger(n) && n >= 1 && n <= 10000,
    ],
  ].map(([name, fallback, validate]) => ({
    name,
    status: validate(Number(process.env[name] || fallback))
      ? "valid"
      : "invalid",
  }));
  const cronValid = (process.env.CRON_SECRET?.length || 0) >= 32;
  const contactValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    process.env.PRIVACY_CONTACT_EMAIL || "",
  );
  const configurationReady =
    report.appPrerequisitesPresent &&
    report.speechCredentialReady &&
    limits.every((item) => item.status === "valid") &&
    cronValid &&
    contactValid;
  console.log(
    JSON.stringify(
      {
        ...report,
        limits,
        recoverySecret: cronValid ? "configured" : "missing-or-invalid",
        privacyContact: contactValid ? "configured" : "missing-or-invalid",
        configurationReady,
        releaseReady: false,
      },
      null,
      2,
    ),
  );
  console.log(
    "Selected direct Speech route. No Agent Builder setup is required. Configuration does not verify the runtime migration, gateway availability, complete final evidence or a real browser session.",
  );
  process.exitCode = configurationReady ? 0 : 1;
} catch {
  console.error(
    "CONFIGURATION_CHECK_FAILED: inspect local configuration; no values printed.",
  );
  process.exitCode = 1;
}
