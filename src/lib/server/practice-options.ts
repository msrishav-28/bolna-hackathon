import "server-only";
import {
  modeSchema,
  modeLabels,
  modeDescriptions,
  practiceOptionsSchema,
} from "../practice-contracts";
import {
  samvaadConfigured,
  maxSessionDuration,
  dailySessionLimit,
} from "./config";
import { topics, databaseError } from "./sessions";
import { admin } from "./supabase";
import { rubricVersion } from "../domain/practice-mode";

export async function practiceOptions(owner: string) {
  const configured = samvaadConfigured();
  const catalogue = await topics();
  const quota = await admin()
    .schema("samvaad")
    .rpc("practice_quota", { p_user: owner, p_limit: dailySessionLimit() });
  databaseError(quota.error);
  return practiceOptionsSchema.parse({
    contractVersion: 2,
    modes: modeSchema.options.map((id) => {
      const durations = ([180, 300] as const).filter(
        (duration) => duration <= maxSessionDuration() && configured,
      );
      const available =
        configured && catalogue.topics.length > 0 && durations.length > 0;
      return {
        id,
        label: modeLabels[id],
        description: modeDescriptions[id],
        available,
        unavailableReason: !configured
          ? "Voice practice is temporarily unavailable."
          : !durations.length
            ? "This practice mode is not configured yet."
            : !catalogue.topics.length
              ? "No topics are available yet."
              : null,
        topics: catalogue.topics,
        durations,
        rubricVersion: rubricVersion(id),
      };
    }),
    quota: quota.data,
  });
}
