import { z } from "zod";

export const SPEECH_PROTOCOL = "samvaad-speech-v1" as const;
export const actorSchema = z.enum([
  "student",
  "coach",
  "moderator",
  "peer_a",
  "peer_b",
]);
export type Actor = z.infer<typeof actorSchema>;
export const actorLabels: Record<Actor, string> = {
  student: "You",
  coach: "AI coach",
  moderator: "AI moderator",
  peer_a: "AI peer A",
  peer_b: "AI peer B",
};
export const clientControlSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("authenticate"),
      grant: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
      protocol: z.literal(SPEECH_PROTOCOL),
    })
    .strict(),
  z.object({ type: z.literal("end") }).strict(),
  z.object({ type: z.literal("ping") }).strict(),
]);
export const serverControlSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("ready"),
    runId: z.uuid(),
    deadline: z.iso.datetime({ offset: true }),
    sampleRate: z.literal(16000),
    remainingMilliseconds: z.number().int().min(1).max(300000),
  }),
  z.object({
    type: z.literal("state"),
    state: z.enum(["listening", "thinking", "speaking"]),
    actor: actorSchema,
  }),
  z.object({
    type: z.literal("clear"),
    generation: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal("audio"),
    generation: z.number().int().nonnegative(),
    pcm: z.string().max(250000),
  }),
  z.object({
    type: z.literal("ended"),
    reason: z.enum(["manual", "deadline"]),
  }),
  z.object({ type: z.literal("error"), code: z.literal("VOICE_FAILED") }),
  z.object({ type: z.literal("pong") }),
]);
export const speechGrantSchema = z.object({
  runId: z.uuid(),
  grant: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  websocketUrl: z.url().refine((value) => {
    const url = new URL(value);
    return (
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      (url.protocol === "wss:" ||
        (url.protocol === "ws:" &&
          ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)))
    );
  }),
  expiresAt: z.iso.datetime({ offset: true }),
  protocol: z.literal(SPEECH_PROTOCOL),
});
