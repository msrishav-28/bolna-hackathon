import { expect, it, vi, afterEach } from "vitest";
import { modeContext } from "@/lib/domain/practice-mode";
import { voiceConfig } from "@/lib/server/config";
import { scoreTranscript } from "@/lib/server/scoring";
import { previewSession } from "@/lib/server/preview-data";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("reserves two thirds of presentation time for protected delivery", () => {
  expect(modeContext("presentation", 180).deliverySeconds).toBe(120);
  expect(modeContext("presentation", 300).deliverySeconds).toBe(200);
  expect(modeContext("interview", 180).deliverySeconds).toBe(0);
});
it("never enables a mode without the explicit owned runtime switch", () => {
  vi.stubEnv("VOICE_RUNTIME_ENABLED", "false");
  expect(() => voiceConfig(180, "interview")).toThrow("CONFIGURATION");
});
it("scores with the persisted mode policy and computes its own total", async () => {
  vi.stubEnv("REASONING_BASE_URL", "https://reasoning.example.test/v1");
  vi.stubEnv("REASONING_API_KEY", "synthetic");
  vi.stubEnv("REASONING_MODEL", "synthetic");
  const fetch = vi.fn().mockResolvedValue(
    Response.json({
      choices: [
        {
          finish_reason: "stop",
          message: {
            content: JSON.stringify({
              ...previewSession.scorecard,
              overallScore: 1,
            }),
          },
        },
      ],
    }),
  );
  vi.stubGlobal("fetch", fetch);
  const score = await scoreTranscript(
    previewSession.transcript!,
    "presentation",
  );
  const request = JSON.parse(fetch.mock.calls[0][1].body);
  expect(request.messages[0].content).toContain("presentation-v1");
  expect(request.messages[0].content).toContain(
    "do not penalize protected delivery",
  );
  expect(score.overallScore).toBe(previewSession.scorecard!.overallScore);
});
