import { z } from "zod";
import { topicSchema } from "./product-contracts";
import type { Difficulty } from "./domain/samvaad";

export { practiceModeSchema as modeSchema } from "./domain/practice-mode";
import { practiceModeSchema as modeSchema } from "./domain/practice-mode";
export type PracticeMode = z.infer<typeof modeSchema>;
export const modeLabels: Record<PracticeMode, string> = {
  interview: "Interview",
  viva: "Viva",
  debate: "Debate",
  group_discussion: "Group discussion",
  presentation: "Presentation",
};
export const modeDescriptions: Record<PracticeMode, string> = {
  interview: "Explain your experience and respond to follow-up questions.",
  viva: "Defend your understanding through focused oral questions.",
  debate: "Make a case and respond to a competing argument.",
  group_discussion: "Practise contributing and responding with one AI partner.",
  presentation: "Deliver your opening, then take questions.",
};
const durationSchema = z.union([z.literal(180), z.literal(300)]);
export const practiceOptionsSchema = z
  .object({
    contractVersion: z.union([z.literal(1), z.literal(2)]),
    modes: z
      .array(
        z.object({
          id: modeSchema,
          label: z.string().min(1),
          description: z.string().min(1),
          available: z.boolean(),
          unavailableReason: z.string().min(1).nullable(),
          topics: z.array(topicSchema),
          durations: z.array(durationSchema),
          rubricVersion: z.string().min(1),
        }),
      )
      .length(5),
    quota: z
      .object({
        limit: z.number().int().positive(),
        remaining: z.number().int().nonnegative(),
        resetsAt: z.iso.datetime({ offset: true }),
      })
      .nullable(),
  })
  .superRefine((value, ctx) => {
    if (new Set(value.modes.map((mode) => mode.id)).size !== 5)
      ctx.addIssue({ code: "custom", message: "Duplicate practice mode" });
    for (const mode of value.modes) {
      if (
        mode.available &&
        (!mode.topics.length ||
          !mode.durations.length ||
          mode.unavailableReason !== null)
      )
        ctx.addIssue({
          code: "custom",
          message: "Available mode needs topics and durations",
        });
      if (!mode.available && !mode.unavailableReason)
        ctx.addIssue({
          code: "custom",
          message: "Unavailable mode needs a reason",
        });
      if (
        value.contractVersion === 1 &&
        mode.available &&
        mode.id !== "group_discussion"
      )
        ctx.addIssue({
          code: "custom",
          message: "Legacy transport only supports group discussion",
        });
    }
    if (value.quota && value.quota.remaining > value.quota.limit)
      ctx.addIssue({ code: "custom", message: "Invalid quota" });
  });
export type PracticeOptions = z.infer<typeof practiceOptionsSchema>;
export function createPracticeBody(
  version: 1 | 2,
  mode: PracticeMode,
  topicId: string,
  difficulty: Difficulty,
  durationSeconds: 180 | 300,
) {
  if (version === 1 && mode !== "group_discussion")
    throw new Error("Unsupported practice mode");
  const legacy = { topicId, difficulty, durationSeconds };
  return version === 1 ? legacy : { ...legacy, mode };
}
