import { describe, expect, it } from "vitest";
import { parseHistoryQuery, mapSession } from "../src/lib/server/sessions";
import { previewSession } from "../src/lib/server/preview-data";

describe("history boundary", () => {
  it("reads a completed PostgreSQL score rounded up from 57.5 without rejecting its report", () => {
    const feedback = structuredClone(previewSession.scorecard!);
    feedback.dimensions.forEach((item, index) => {
      item.score = index === 7 ? 2 : 3;
    });
    const mapped = mapSession({
      id: previewSession.id,
      mode: previewSession.mode,
      rubric_version: previewSession.rubricVersion,
      topic: previewSession.topic,
      difficulty: previewSession.difficulty,
      planned_duration_seconds: 180,
      status: "completed",
      created_at: previewSession.createdAt,
      started_at: previewSession.startedAt,
      completed_at: previewSession.completedAt,
      overall_score: 58,
      transcript: previewSession.transcript,
      dimension_scores: feedback.dimensions,
      strongest_moment: feedback.strongestMoment,
      weakest_moment: feedback.weakestMoment,
      practice_actions: feedback.practiceActions,
    });
    expect(mapped.overallScore).toBe(58);
    expect(mapped).toMatchObject({ scorecard: { overallScore: 58 } });
  });
  it("rejects malformed and injectable cursors", () => {
    for (const cursor of [
      "",
      "invalid",
      Buffer.from(JSON.stringify({ at: "x),id.gt.0", id: "bad" })).toString(
        "base64url",
      ),
    ]) {
      expect(() =>
        parseHistoryQuery(new URLSearchParams({ cursor })),
      ).toThrow();
    }
  });
  it("bounds lists and validates status", () => {
    expect(parseHistoryQuery(new URLSearchParams()).limit).toBe(20);
    expect(() =>
      parseHistoryQuery(new URLSearchParams({ limit: "51" })),
    ).toThrow();
    expect(() =>
      parseHistoryQuery(new URLSearchParams({ status: "fake" })),
    ).toThrow();
  });
  it("does not expose unfinished scores or provider error content", () => {
    const session = mapSession({
      id: "20000000-0000-4000-8000-000000000001",
      topic: {
        id: "20000000-0000-4000-8000-000000000002",
        title: "Synthetic topic",
        category: "Education",
        description: "Synthetic description",
      },
      difficulty: "standard",
      planned_duration_seconds: 180,
      status: "failed",
      created_at: "2026-10-28T00:00:00Z",
      started_at: null,
      completed_at: null,
      overall_score: 88,
      error_message: "private provider content",
    });
    expect(session.overallScore).toBeNull();
    expect(JSON.stringify(session)).not.toContain("private provider content");
  });
});
