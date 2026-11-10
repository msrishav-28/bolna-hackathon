import { describe, expect, it } from "vitest";
import {
  DIMENSION_GUIDE,
  SCORE_DIMENSIONS,
  canTransition,
  samvaadSetupSchema,
  samvaadTopics,
  durationAllowed,
  type SessionStatus,
} from "../src/lib/domain/samvaad";

const TOPIC_ID = "8b1b3d5e-3f4a-4c5b-8d9e-0a1b2c3d4e5f";

describe("Samvaad topics", () => {
  it("ships exactly the five approved topics in display order", () => {
    expect(samvaadTopics.map((topic) => topic.title)).toEqual([
      "Should colleges allow AI tools for assignments?",
      "Is remote work better for early career growth?",
      "Should social media have age verification?",
      "Are internships better than classroom learning?",
      "Should India prioritize AI skills in every degree?",
    ]);
    expect(samvaadTopics.map((topic) => topic.sortOrder)).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  it("keeps topic titles unique and descriptions useful", () => {
    expect(new Set(samvaadTopics.map((topic) => topic.title)).size).toBe(5);
    expect(
      samvaadTopics.every(
        (topic) =>
          topic.description.trim().length >= 20 &&
          ["Education", "Career", "Society", "Policy"].includes(topic.category),
      ),
    ).toBe(true);
  });
});

describe("Samvaad setup", () => {
  it("accepts a supported topic, difficulty and duration", () => {
    expect(
      samvaadSetupSchema.parse({
        topicId: TOPIC_ID,
        difficulty: "standard",
        durationSeconds: 300,
      }),
    ).toEqual({
      topicId: TOPIC_ID,
      difficulty: "standard",
      durationSeconds: 300,
    });
    expect(
      samvaadSetupSchema.safeParse({
        topicId: TOPIC_ID,
        difficulty: "gentle",
        durationSeconds: 180,
      }).success,
    ).toBe(true);
    expect(
      samvaadSetupSchema.safeParse({
        topicId: TOPIC_ID,
        difficulty: "intense",
        durationSeconds: 300,
      }).success,
    ).toBe(true);
  });

  it("rejects unsupported durations, difficulties, ids and extra fields", () => {
    const base = {
      topicId: TOPIC_ID,
      difficulty: "standard",
      durationSeconds: 300,
    };
    expect(
      samvaadSetupSchema.safeParse({ ...base, durationSeconds: 240 }).success,
    ).toBe(false);
    expect(
      samvaadSetupSchema.safeParse({ ...base, durationSeconds: "300" }).success,
    ).toBe(false);
    expect(
      samvaadSetupSchema.safeParse({ ...base, difficulty: "hard" }).success,
    ).toBe(false);
    expect(
      samvaadSetupSchema.safeParse({ ...base, topicId: "not-a-uuid" }).success,
    ).toBe(false);
    expect(
      samvaadSetupSchema.safeParse({ ...base, language: "en" }).success,
    ).toBe(false);
  });

  it("never allows a duration above the configured cap", () => {
    expect(durationAllowed(180, 300)).toBe(true);
    expect(durationAllowed(300, 300)).toBe(true);
    expect(durationAllowed(180, 180)).toBe(true);
    expect(durationAllowed(300, 180)).toBe(false);
    expect(durationAllowed(240, 300)).toBe(false);
  });
});

describe("Samvaad session transitions", () => {
  it.each<[SessionStatus, SessionStatus]>([
    ["created", "awaiting_voice"],
    ["created", "in_progress"],
    ["awaiting_voice", "in_progress"],
    ["awaiting_voice", "processing"],
    ["in_progress", "processing"],
    ["processing", "completed"],
    ["processing", "failed"],
    ["failed", "processing"],
    ["created", "failed"],
    ["in_progress", "expired"],
  ])("allows %s -> %s", (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each<[SessionStatus, SessionStatus]>([
    ["created", "completed"],
    ["created", "processing"],
    ["awaiting_voice", "completed"],
    ["in_progress", "completed"],
    ["completed", "processing"],
    ["expired", "in_progress"],
    ["failed", "in_progress"],
    ["in_progress", "in_progress"],
  ])("rejects %s -> %s", (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });

  it("treats completion and expiry as terminal", () => {
    for (const status of ["completed", "expired"] as const) {
      expect(canTransition(status, "processing")).toBe(false);
      expect(canTransition(status, "failed")).toBe(false);
    }
  });
});

describe("Samvaad dimensions", () => {
  it("defines each scoring dimension exactly once with a plain-language guide", () => {
    expect(SCORE_DIMENSIONS).toHaveLength(8);
    expect(new Set(SCORE_DIMENSIONS).size).toBe(8);
    expect(Object.keys(DIMENSION_GUIDE).sort()).toEqual(
      [...SCORE_DIMENSIONS].sort(),
    );
    for (const dimension of SCORE_DIMENSIONS) {
      expect(DIMENSION_GUIDE[dimension].label.length).toBeGreaterThan(5);
      expect(DIMENSION_GUIDE[dimension].description.length).toBeGreaterThan(10);
    }
  });
});
