import { expect, it, vi } from "vitest";
import { speechConfiguration } from "../scripts/check-speech-config.mjs";

it("permits an isolated Speech probe without legacy agent keys or app services", () => {
  const report = speechConfiguration({
    GNANI_SPEECH_API_KEY: "synthetic-private-key",
  });
  expect(report.speechCredentialReady).toBe(true);
  expect(report.appPrerequisitesPresent).toBe(false);
  expect(report.fullBrowserSessionReady).toBe(false);
  expect(JSON.stringify(report)).not.toContain("synthetic-private-key");
  expect(
    report.checks.some(({ name }: { name: string }) =>
      name.startsWith("GNANI_AGENT_ID"),
    ),
  ).toBe(false);
});

it("never confuses a fully populated environment with a finished browser integration", () => {
  const request = vi.fn();
  vi.stubGlobal("fetch", request);
  try {
    const values = Object.fromEntries(
      speechConfiguration({}).checks.map(({ name }: { name: string }) => [
        name,
        "synthetic-placeholder",
      ]),
    );
    Object.assign(values, {
      APP_ORIGIN: "http://127.0.0.1:3013",
      NEXT_PUBLIC_SUPABASE_URL: "https://synthetic.supabase.co",
      REASONING_BASE_URL: "https://reasoning.example/v1",
      REASONING_MODEL: "synthetic-model",
      REASONING_API_KEY: "synthetic-key",
    });
    const report = speechConfiguration(values);
    expect(report.appPrerequisitesPresent).toBe(true);
    expect(report.fullBrowserSessionReady).toBe(false);
    expect(request).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});

it("rejects unsafe URLs and malformed credentials without revealing their values", () => {
  const report = speechConfiguration({
    GNANI_SPEECH_API_KEY: "secret\nheader",
    REASONING_BASE_URL:
      "https://private:password@reasoning.example/v1?token=secret",
  });
  expect(report.speechCredentialReady).toBe(false);
  expect(
    report.checks.find(
      ({ name }: { name: string }) => name === "REASONING_BASE_URL",
    )?.status,
  ).toBe("invalid");
  expect(JSON.stringify(report)).not.toMatch(/password|header|token=secret/);
});
