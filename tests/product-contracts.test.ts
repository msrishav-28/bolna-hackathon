import { describe, expect, it } from "vitest";
import { sessionSchema, sessionHref } from "@/lib/product-contracts";
import { previewSession } from "@/lib/server/preview-data";

describe("product response boundary", () => {
  it("rejects actor metadata that contradicts the trusted transcript role", () => {
    const data = structuredClone(previewSession);
    data.transcript!.turns[0].actor =
      data.transcript!.turns[0].speaker === "user" ? "peer_a" : "student";
    expect(sessionSchema.safeParse(data).success).toBe(false);
  });
  it("accepts grounded feedback with a calculated total", () => {
    expect(sessionSchema.parse(previewSession).overallScore).toBe(75);
  });
  it.each(["missing", "quote", "total", "dimension", "actions"])(
    "rejects invalid completed feedback: %s",
    (fault) => {
      const data = structuredClone(previewSession);
      if (fault === "missing") data.transcript = null;
      if (fault === "quote")
        data.scorecard!.strongestMoment.quote =
          "This sentence was never spoken.";
      if (fault === "total") data.overallScore = 99;
      if (fault === "dimension")
        data.scorecard!.dimensions[1] = data.scorecard!.dimensions[0];
      if (fault === "actions") data.scorecard!.practiceActions.pop();
      expect(sessionSchema.safeParse(data).success).toBe(false);
    },
  );
  it("routes unfinished and failed sessions to recovery, not a scorecard", () => {
    expect(sessionHref({ ...previewSession, status: "failed" })).toContain(
      "/processing",
    );
    expect(sessionHref({ ...previewSession, status: "created" })).toContain(
      "/check",
    );
    expect(sessionHref(previewSession)).toContain("/report/");
  });
});
