import { afterEach, describe, expect, it, vi } from "vitest";
import { providerJson } from "../src/lib/server/provider-http";
import { scoreTranscript } from "../src/lib/server/scoring";
import { secureBase, voiceConfig } from "../src/lib/server/config";
import { secretMatches } from "../src/lib/server/secrets";
import { previewSession } from "../src/lib/server/preview-data";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("provider and secret boundaries", () => {
  it("preserves Gnani capacity status for the browser SDK without exposing upstream details", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ private: "upstream content" }, { status: 429 }),
        ),
    );
    await expect(
      providerJson("https://example.test", {}, "GNANI_ERROR"),
    ).rejects.toMatchObject({
      code: "GNANI_ERROR",
      status: 429,
      retryable: true,
    });
  });
  it("does not expose upstream errors or follow redirects", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(Response.json({ private: "secret" }, { status: 401 }));
    vi.stubGlobal("fetch", fetch);
    await expect(
      providerJson("https://example.test", {}, "GNANI_ERROR"),
    ).rejects.toMatchObject({ code: "GNANI_ERROR", message: "GNANI_ERROR" });
    expect(fetch).toHaveBeenCalledWith(
      "https://example.test",
      expect.objectContaining({ redirect: "error", cache: "no-store" }),
    );
  });
  it("bounds provider bodies and rejects unreadable responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("a".repeat(500))),
    );
    await expect(
      providerJson("https://example.test", {}, "GNANI_ERROR", 1000, 50),
    ).rejects.toMatchObject({ code: "GNANI_ERROR" });
  });
  it("requires secure configured endpoints and an explicit runtime switch", () => {
    for (const value of [
      "http://example.test",
      "https://name:pass@example.test",
      "https://example.test?key=secret",
      "invalid",
    ]) {
      vi.stubEnv("REASONING_BASE_URL", value);
      expect(() => secureBase("REASONING_BASE_URL")).toThrow("CONFIGURATION");
    }
    vi.stubEnv("VOICE_RUNTIME_ENABLED", "false");
    expect(() => voiceConfig(180)).toThrow("CONFIGURATION");
  });
  it("compares secrets without accepting empty, prefix or oversized inputs", () => {
    const secret = "s".repeat(32);
    expect(secretMatches(secret, secret)).toBe(true);
    for (const value of [null, "", secret + "x", "s".repeat(3000)])
      expect(secretMatches(value, secret)).toBe(false);
  });
  it("rejects ungrounded and truncated model output and treats transcript instructions as data", async () => {
    vi.stubEnv("REASONING_BASE_URL", "https://score.example.test/v1");
    vi.stubEnv("REASONING_API_KEY", "synthetic");
    vi.stubEnv("REASONING_MODEL", "synthetic");
    const score = structuredClone(previewSession.scorecard!);
    score.strongestMoment.quote = "Invented words that nobody said.";
    const fetch = vi.fn().mockResolvedValue(
      Response.json({
        choices: [
          {
            finish_reason: "stop",
            message: { content: JSON.stringify(score) },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetch);
    await expect(
      scoreTranscript(previewSession.transcript!),
    ).rejects.toMatchObject({ code: "SCORING_FAILED" });
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.messages[0].content).toContain("untrusted transcript data");
    expect(JSON.parse(body.messages[1].content).transcript).toEqual(
      previewSession.transcript!.turns,
    );
    fetch.mockResolvedValue(
      Response.json({
        choices: [
          {
            finish_reason: "length",
            message: { content: JSON.stringify(previewSession.scorecard) },
          },
        ],
      }),
    );
    await expect(
      scoreTranscript(previewSession.transcript!),
    ).rejects.toMatchObject({ code: "SCORING_FAILED" });
  });
});

it("uses strict scorecard structure for the selected supported Groq model", async () => {
  vi.stubEnv("REASONING_PROVIDER", "groq");
  vi.stubEnv("GROQ_API_KEY", "synthetic-key");
  vi.stubEnv("GROQ_MODEL", "openai/gpt-oss-120b");
  const fetch = vi.fn().mockResolvedValue(
    Response.json({
      choices: [
        {
          finish_reason: "stop",
          message: { content: JSON.stringify(previewSession.scorecard) },
        },
      ],
    }),
  );
  vi.stubGlobal("fetch", fetch);
  await scoreTranscript(previewSession.transcript!);
  const body = JSON.parse(fetch.mock.calls[0][1].body);
  expect(body.response_format.type).toBe("json_schema");
  const contract = body.response_format.json_schema;
  expect(contract.strict).toBe(true);
  expect(contract.schema.additionalProperties).toBe(false);
  expect(contract.schema.properties.practiceActions).toMatchObject({
    minItems: 3,
    maxItems: 3,
  });
  expect(contract.schema.properties.dimensions).toMatchObject({
    minItems: 8,
    maxItems: 8,
  });
  expect(contract.schema.properties.overallScore).toBeUndefined();
});
