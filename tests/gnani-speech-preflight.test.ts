import { afterEach, expect, it, vi } from "vitest";
import { boundedBody, probe } from "../scripts/gnani-speech-preflight.mjs";
afterEach(() => vi.unstubAllGlobals());
function wav() {
  const audio = Buffer.alloc(44);
  audio.write("RIFF", 0);
  audio.write("WAVE", 8);
  return audio;
}
it("makes no request without a Speech credential", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await expect(probe("")).rejects.toThrow("MISSING_SPEECH_KEY");
  expect(fetcher).not.toHaveBeenCalled();
});
it("pins private requests and returns neither key nor transcript", async () => {
  const transcript = "A synthetic private fixture.";
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response(wav()))
    .mockResolvedValueOnce(
      Response.json({ success: true, model: "prisma-v3.0", transcript }),
    );
  vi.stubGlobal("fetch", fetcher);
  const result = await probe("synthetic-test-key");
  expect(result).toMatchObject({
    nonemptyTranscript: true,
    realtimeVerified: false,
    browserVerified: false,
  });
  expect(JSON.stringify(result)).not.toContain(transcript);
  expect(JSON.stringify(result)).not.toContain("synthetic-test-key");
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
    "https://api.vachana.ai/api/v1/tts/inference",
    "https://api.vachana.ai/stt/v3",
  ]);
  for (const [, init] of fetcher.mock.calls) {
    expect(init.redirect).toBe("error");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  }
  const fields = fetcher.mock.calls[1][1].body as FormData;
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({
    model: "timbre-v3.0",
    voice: "Shivani",
    language: "en-IN",
  });
  expect(fields.get("model")).toBe("prisma-v3.0");
  expect(fields.get("format")).toBe("verbatim");
  expect(fields.get("language_code")).toBe("en-IN");
});
it("never sends invalid synthesis to recognition", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response("not audio"));
  vi.stubGlobal("fetch", fetcher);
  await expect(probe("synthetic-key")).rejects.toThrow(
    "INVALID_SYNTHESIS_AUDIO",
  );
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("rejects truncated success responses", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(new Response(wav()))
      .mockResolvedValueOnce(
        Response.json({
          success: true,
          model: "prisma-v3.0",
          transcript: "synthetic",
          truncated: true,
        }),
      ),
  );
  await expect(probe("synthetic-key")).rejects.toThrow(
    "INVALID_RECOGNITION_RESULT",
  );
});
it("bounds bodies and never retries failed paid requests automatically", async () => {
  await expect(boundedBody(new Response("12345"), 4)).rejects.toThrow(
    "RESPONSE_INVALID",
  );
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response(null, { status: 429 }));
  vi.stubGlobal("fetch", fetcher);
  await expect(probe("synthetic-key")).rejects.toThrow("PROVIDER_HTTP_429");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
