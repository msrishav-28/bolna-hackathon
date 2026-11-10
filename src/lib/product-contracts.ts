import { z } from "zod";
import {
  difficultySchema,
  sessionStatusSchema,
  scorecardModelSchema,
  validateScorecard,
} from "@/lib/domain/samvaad";

export const topicSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1),
  category: z.string(),
  description: z.string(),
});
export const topicsSchema = z.object({ topics: z.array(topicSchema).max(5) });
export type Topic = z.infer<typeof topicSchema>;
export const summarySchema = z.object({
  mode: z
    .enum(["interview", "viva", "debate", "group_discussion", "presentation"])
    .optional(),
  rubricVersion: z.string().min(1).optional(),
  id: z.uuid(),
  topic: topicSchema,
  difficulty: difficultySchema,
  durationSeconds: z.union([z.literal(180), z.literal(300)]),
  status: sessionStatusSchema,
  createdAt: z.iso.datetime({ offset: true }),
  startedAt: z.iso.datetime({ offset: true }).nullable(),
  completedAt: z.iso.datetime({ offset: true }).nullable(),
  overallScore: z.number().int().min(0).max(100).nullable(),
});
export type SessionSummary = z.infer<typeof summarySchema>;
export const sessionSchema = summarySchema
  .extend({
    transcript: z
      .object({
        raw: z.string(),
        parsed: z.boolean(),
        turns: z.array(
          z
            .object({
              speaker: z.enum(["assistant", "user"]),
              text: z.string(),
              actor: z
                .enum(["student", "coach", "moderator", "peer_a", "peer_b"])
                .optional(),
              delivery: z.enum(["provider-final", "sent"]).optional(),
            })
            .superRefine((turn, ctx) => {
              if (
                (turn.actor &&
                  (turn.actor === "student") !== (turn.speaker === "user")) ||
                (turn.delivery &&
                  (turn.delivery === "provider-final") !==
                    (turn.speaker === "user"))
              )
                ctx.addIssue({
                  code: "custom",
                  message:
                    "Transcript actor/delivery must match the evidence channel.",
                });
            }),
        ),
      })
      .nullable(),
    scorecard: scorecardModelSchema.nullable(),
    error: z
      .object({ code: z.string(), message: z.string(), retryable: z.boolean() })
      .nullable(),
  })
  .superRefine((session, ctx) => {
    if (session.mode && !session.rubricVersion)
      ctx.addIssue({ code: "custom", message: "Mode requires rubric version" });
    if (
      session.status === "completed" &&
      (!session.scorecard || !session.transcript)
    )
      ctx.addIssue({
        code: "custom",
        message: "Completed session requires verified feedback.",
      });
    if (session.scorecard) {
      try {
        if (!session.transcript) throw new Error();
        const validated = validateScorecard(
          session.scorecard,
          session.transcript,
        );
        if (
          validated.overallScore !== session.scorecard.overallScore ||
          validated.overallScore !== session.overallScore
        )
          throw new Error();
      } catch {
        ctx.addIssue({
          code: "custom",
          message: "Invalid scorecard evidence or total.",
        });
      }
    }
  });
export const sessionResponseSchema = z.object({ session: sessionSchema });
export type ProductSession = z.infer<typeof sessionSchema>;
export const historySchema = z.object({
  sessions: z.array(summarySchema),
  nextCursor: z.string().nullable(),
  stats: z.object({
    comparison: z
      .object({
        mode: z.enum([
          "interview",
          "viva",
          "debate",
          "group_discussion",
          "presentation",
        ]),
        topicId: z.uuid(),
        rubricVersion: z.string().min(1),
        count: z.number().int().min(2),
        baselineScore: z.number().min(0).max(100),
        latestScore: z.number().min(0).max(100),
        bestScore: z.number().min(0).max(100),
        trend: z
          .array(
            z.object({
              id: z.uuid(),
              score: z.number().min(0).max(100),
              completedAt: z.iso.datetime({ offset: true }),
            }),
          )
          .min(2)
          .max(20),
      })
      .nullable()
      .optional(),
    completed: z.number().int().nonnegative(),
    averageScore: z.number().min(0).max(100).nullable(),
    focus: z.string().nullable(),
    trend: z
      .array(
        z.object({
          id: z.uuid(),
          score: z.number().min(0).max(100),
          completedAt: z.iso.datetime({ offset: true }),
        }),
      )
      .max(20),
  }),
});
export type HistoryData = z.infer<typeof historySchema>;
export const difficultyLabels = {
  gentle: "Gentle",
  standard: "Standard",
  intense: "Intense",
} as const;
export const statusLabels = {
  created: "Ready to begin",
  awaiting_voice: "Connecting",
  in_progress: "In progress",
  processing: "Preparing feedback",
  completed: "Completed",
  failed: "Needs attention",
  expired: "Expired",
} as const;
export function sessionHref(session: SessionSummary) {
  if (session.status === "completed") return `/report/${session.id}`;
  if (session.status === "created")
    return `/practice/session/${session.id}/check`;
  if (
    session.status === "processing" ||
    session.status === "failed" ||
    session.status === "expired"
  )
    return `/practice/session/${session.id}/processing`;
  return `/practice/session/${session.id}`;
}
