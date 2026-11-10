import { afterEach, expect, it, vi } from "vitest";
import {
  resolveReasoning,
  reasoningProfile,
} from "../src/lib/reasoning-config.mjs";
import { scoreTranscript } from "../src/lib/server/scoring";
import { previewSession } from "../src/lib/server/preview-data";
import { checkReasoning } from "../scripts/check-reasoning.mjs";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("checks configuration offline and keeps live model listing separate from inference and free quota", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(Response.json({ data: [{ id: "gemini-3.8-flash" }] }));
  vi.stubGlobal("fetch", fetcher);
  const env = { GEMINI_API_KEY: "synthetic-private-key" };
  const offline = await checkReasoning(env);
  expect(fetcher).not.toHaveBeenCalled();
  const live = await checkReasoning(env, true);
  expect(live).toMatchObject({
    catalogChecked: true,
    modelAvailable: true,
    inferenceVerified: false,
    freeQuotaVerified: false,
  });
  expect(fetcher).toHaveBeenCalledWith(
    "https://generativelanguage.googleapis.com/v1beta/openai/models",
    expect.objectContaining({ redirect: "error" }),
  );
  expect(JSON.stringify([offline, live])).not.toContain(
    "synthetic-private-key",
  );
  fetcher.mockResolvedValueOnce(new Response(null, { status: 401 }));
  await expect(checkReasoning(env, true)).rejects.toThrow("PROVIDER_HTTP_401");
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("resolves Gemini from only its API key with a pinned model and official base", () => {
  expect(
    resolveReasoning({ GEMINI_API_KEY: "synthetic-google-key" }),
  ).toMatchObject({
    provider: "gemini",
    model: "gemini-3.8-flash",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    apiKey: "synthetic-google-key",
  });
});

it("keeps both credentials isolated and never switches to Groq on missing Gemini configuration", () => {
  const keys = {
    GEMINI_API_KEY: "synthetic-google",
    GROQ_API_KEY: "synthetic-groq",
  };
  expect(resolveReasoning(keys).apiKey).toBe("synthetic-google");
  expect(
    resolveReasoning({ ...keys, REASONING_PROVIDER: "groq" }),
  ).toMatchObject({
    apiKey: "synthetic-groq",
    model: "openai/gpt-oss-120b",
    baseUrl: "https://api.groq.com/openai/v1",
  });
  expect(() => resolveReasoning({ GROQ_API_KEY: "synthetic-groq" })).toThrow(
    "CONFIGURATION",
  );
  expect(() =>
    resolveReasoning({
      REASONING_PROVIDER: "groq",
      GEMINI_API_KEY: "synthetic-google",
      REASONING_API_KEY: "synthetic-generic",
    }),
  ).toThrow("CONFIGURATION");
});

it("preserves manual providers and rejects invalid selection and unsafe custom URLs", () => {
  expect(
    resolveReasoning({
      REASONING_BASE_URL: "https://reasoning.example/v1/",
      REASONING_MODEL: "synthetic-model",
      REASONING_API_KEY: "synthetic-key",
    }).baseUrl,
  ).toBe("https://reasoning.example/v1");
  for (const base of [
    "http://reasoning.example",
    "https://user:secret@reasoning.example",
    "https://reasoning.example?token=secret",
  ]) {
    expect(() =>
      reasoningProfile({ REASONING_BASE_URL: base, REASONING_MODEL: "test" }),
    ).toThrow("CONFIGURATION");
  }
  expect(() => reasoningProfile({ REASONING_PROVIDER: "typo" })).toThrow(
    "CONFIGURATION",
  );
  expect(() => resolveReasoning({ GEMINI_API_KEY: "secret\nheader" })).toThrow(
    "CONFIGURATION",
  );
});

it("uses the selected Groq credentials, model and URL in actual scoring without a second provider call", async () => {
  vi.stubEnv("REASONING_PROVIDER", "groq");
  vi.stubEnv("GROQ_API_KEY", "synthetic-groq-key");
  vi.stubEnv("GEMINI_API_KEY", "synthetic-google-key");
  const fetcher = vi.fn().mockResolvedValue(
    Response.json({
      choices: [
        {
          finish_reason: "stop",
          message: { content: JSON.stringify(previewSession.scorecard) },
        },
      ],
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  await scoreTranscript(previewSession.transcript!);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][0]).toBe(
    "https://api.groq.com/openai/v1/chat/completions",
  );
  const options = fetcher.mock.calls[0][1];
  expect(options.headers.Authorization).toBe("Bearer synthetic-groq-key");
  expect(JSON.parse(options.body).model).toBe("openai/gpt-oss-120b");
});
