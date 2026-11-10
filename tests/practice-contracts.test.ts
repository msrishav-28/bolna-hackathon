import { expect, it } from "vitest";
import {
  createPracticeBody,
  modeSchema,
  practiceOptionsSchema,
} from "@/lib/practice-contracts";
import { previewTopics } from "@/lib/server/preview-data";
const options = () => ({
  contractVersion: 1,
  quota: null,
  modes: modeSchema.options.map((id) => ({
    id,
    label: id,
    description: "Synthetic mode",
    available: id === "group_discussion",
    unavailableReason: id === "group_discussion" ? null : "Unavailable",
    topics: id === "group_discussion" ? previewTopics : [],
    durations: id === "group_discussion" ? [180, 300] : [],
    rubricVersion: "synthetic-v1",
  })),
});
it("keeps legacy creation strict and only adds mode for the versioned backend", () => {
  expect(
    createPracticeBody(
      1,
      "group_discussion",
      previewTopics[0].id,
      "standard",
      180,
    ),
  ).toEqual({
    topicId: previewTopics[0].id,
    difficulty: "standard",
    durationSeconds: 180,
  });
  expect(() =>
    createPracticeBody(1, "interview", previewTopics[0].id, "standard", 180),
  ).toThrow();
  expect(
    createPracticeBody(2, "interview", previewTopics[0].id, "standard", 180),
  ).toHaveProperty("mode", "interview");
});
it("rejects duplicate modes and unsupported availability rather than falling back", () => {
  expect(practiceOptionsSchema.safeParse(options()).success).toBe(true);
  const duplicate = options();
  duplicate.modes[0] = duplicate.modes[1];
  expect(practiceOptionsSchema.safeParse(duplicate).success).toBe(false);
  const unsupported = options();
  unsupported.modes[0] = {
    ...unsupported.modes[0],
    available: true,
    topics: previewTopics,
    durations: [180],
    unavailableReason: null,
  };
  expect(practiceOptionsSchema.safeParse(unsupported).success).toBe(false);
});
it("rejects an impossible quota", () => {
  expect(
    practiceOptionsSchema.safeParse({
      ...options(),
      quota: { limit: 2, remaining: 3, resetsAt: new Date().toISOString() },
    }).success,
  ).toBe(false);
});
