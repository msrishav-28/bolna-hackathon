import "server-only";
import { samvaadTopics, SCORE_DIMENSIONS } from "@/lib/domain/samvaad";
import { sessionSchema, type HistoryData } from "@/lib/product-contracts";

// Synthetic design-review content, reachable only through the gated preview route.
// Never import this module into a product API or use it as a request fallback.
export const previewTopics = samvaadTopics.map((topic, index) => ({
  id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  title: topic.title,
  category: topic.category,
  description: topic.description,
}));
const words =
  "Colleges should allow AI tools when students explain how they used them. For example, a student could compare an AI suggestion with their own solution and discuss where it falls short. That makes the reasoning visible instead of replacing it.";
const closing =
  "My position is that access should come with a clear explanation of the work. The student still needs to show their own reasoning and be able to defend it.";
export const previewSession = sessionSchema.parse({
  id: "20000000-0000-4000-8000-000000000001",
  topic: previewTopics[0],
  difficulty: "standard",
  durationSeconds: 300,
  status: "completed",
  createdAt: "2026-10-26T09:00:00Z",
  startedAt: "2026-10-26T09:01:00Z",
  completedAt: "2026-10-26T09:06:00Z",
  overallScore: 75,
  error: null,
  transcript: {
    raw: `assistant: Should colleges allow AI tools for assignments?\nuser: ${words}\nassistant: How would a teacher know the reasoning was the student’s own?\nuser: ${closing}`,
    parsed: true,
    turns: [
      {
        speaker: "assistant",
        text: "Should colleges allow AI tools for assignments?",
      },
      { speaker: "user", text: words },
      {
        speaker: "assistant",
        text: "How would a teacher know the reasoning was the student’s own?",
      },
      { speaker: "user", text: closing },
    ],
  },
  scorecard: {
    overallScore: 75,
    strongestMoment: {
      title: "You made the idea concrete.",
      reason:
        "Your comparison between the AI suggestion and the student’s own solution gave the panel a specific approach to discuss.",
      quote: "a student could compare an AI suggestion with their own solution",
    },
    weakestMoment: {
      title: "The challenge needed a direct answer.",
      reason:
        "When asked how a teacher could verify authorship, you returned to explaining the principle without naming a concrete check.",
      quote: "The student still needs to show their own reasoning",
    },
    dimensions: SCORE_DIMENSIONS.map((dimension, index) => ({
      dimension,
      score: [4, 4, 4, 3, 3, 4, 4, 4][index],
      reason: [
        "You stated your position directly and kept the language easy to follow.",
        "Your opening moved from a claim to a reason and a specific example.",
        "Your responses stayed focused on college assignments and student reasoning.",
        "The comparison example helped, but the verification method needed more detail.",
        "You acknowledged the challenge but repeated the principle instead of offering a check.",
        "Each response advanced the point without unnecessary repetition.",
        "After the challenge, your text returned to a coherent position. This does not assess vocal delivery.",
        "You ended with a clear condition for allowing access to AI tools.",
      ][index],
      evidenceQuote:
        index === 0
          ? "Colleges should allow AI tools when students explain how they used them."
          : null,
    })),
    practiceActions: [
      {
        title: "Answer the challenge first.",
        detail:
          "Start your next rebuttal with one concrete response to the question before returning to your position.",
      },
      {
        title: "Give your example a test.",
        detail:
          "Add one sentence explaining how a teacher could check the student’s reasoning, such as a short oral explanation.",
      },
      {
        title: "Close in two sentences.",
        detail:
          "State your position, then name the condition that makes it work. Stop once those two ideas are clear.",
      },
    ],
  },
});
export const previewHistory: HistoryData = {
  sessions: [
    previewSession,
    {
      ...previewSession,
      id: "20000000-0000-4000-8000-000000000002",
      topic: previewTopics[1],
      overallScore: 65,
      createdAt: "2026-10-24T09:00:00Z",
      completedAt: "2026-10-24T09:06:00Z",
    },
    {
      ...previewSession,
      id: "20000000-0000-4000-8000-000000000003",
      topic: previewTopics[3],
      overallScore: 60,
      createdAt: "2026-10-22T09:00:00Z",
      completedAt: "2026-10-22T09:06:00Z",
    },
  ],
  nextCursor: null,
  stats: {
    completed: 3,
    averageScore: 66.67,
    focus: "Make your response to a challenge more specific.",
    trend: [
      {
        id: "20000000-0000-4000-8000-000000000003",
        score: 60,
        completedAt: "2026-10-22T09:06:00Z",
      },
      {
        id: "20000000-0000-4000-8000-000000000002",
        score: 65,
        completedAt: "2026-10-24T09:06:00Z",
      },
      {
        id: "20000000-0000-4000-8000-000000000001",
        score: 75,
        completedAt: "2026-10-26T09:06:00Z",
      },
    ],
  },
};
