import { z } from "zod";
import { practiceModeSchema } from "./practice-mode";

export const sessionStatusSchema = z.enum([
  "created",
  "awaiting_voice",
  "in_progress",
  "processing",
  "completed",
  "failed",
  "expired",
]);
export type SessionStatus = z.infer<typeof sessionStatusSchema>;

export const difficultySchema = z.enum(["gentle", "standard", "intense"]);
export type Difficulty = z.infer<typeof difficultySchema>;

export const SCORE_DIMENSIONS = [
  "clarity",
  "structure",
  "relevance",
  "evidence",
  "counterargument_handling",
  "conciseness",
  "composure",
  "closing",
] as const;
export type ScoreDimension = (typeof SCORE_DIMENSIONS)[number];

export const DIMENSION_GUIDE: Record<
  ScoreDimension,
  { label: string; description: string }
> = {
  clarity: {
    label: "Did people understand you quickly",
    description: "Clear language and a direct point.",
  },
  structure: {
    label: "Did your point have shape",
    description: "Claim, reason, example, conclusion.",
  },
  relevance: {
    label: "Did you stay on topic",
    description: "Focus on the selected practice topic and task.",
  },
  evidence: {
    label: "Did you support your point",
    description: "Examples, facts, reasoning, concrete cases.",
  },
  counterargument_handling: {
    label: "Did you respond when challenged",
    description: "A direct response instead of repetition.",
  },
  conciseness: {
    label: "Did you avoid rambling",
    description: "Efficient use of speaking time.",
  },
  composure: {
    label: "Did you stay steady",
    description:
      "Coherent written response and recovery after a challenge; no vocal inference.",
  },
  closing: {
    label: "Did you end strongly",
    description: "A clear final position or summary.",
  },
};

export const samvaadTopics = [
  {
    title: "Should colleges allow AI tools for assignments?",
    category: "Education",
    description:
      "Where is the line between using AI as a tool and letting it do the work?",
    sortOrder: 1,
  },
  {
    title: "Is remote work better for early career growth?",
    category: "Career",
    description:
      "Does remote work build skills, or delay the feedback that early careers need?",
    sortOrder: 2,
  },
  {
    title: "Should social media have age verification?",
    category: "Society",
    description:
      "Would age checks protect teenagers, or create new privacy and access problems?",
    sortOrder: 3,
  },
  {
    title: "Are internships better than classroom learning?",
    category: "Education",
    description:
      "Which setting teaches you faster: a classroom or a real workplace?",
    sortOrder: 4,
  },
  {
    title: "Should India prioritize AI skills in every degree?",
    category: "Policy",
    description:
      "Should every degree include AI skills, or only the courses that need them?",
    sortOrder: 5,
  },
] as const;

export const samvaadSetupSchema = z
  .object({
    topicId: z.uuid(),
    difficulty: difficultySchema,
    durationSeconds: z.union([z.literal(180), z.literal(300)]),
    mode: practiceModeSchema.optional(),
  })
  .strict();
export type SamvaadSetup = z.infer<typeof samvaadSetupSchema>;

export function durationAllowed(durationSeconds: number, maxSeconds: number) {
  return (
    (durationSeconds === 180 || durationSeconds === 300) &&
    durationSeconds <= maxSeconds
  );
}

const TRANSITIONS: Record<SessionStatus, readonly SessionStatus[]> = {
  created: ["awaiting_voice", "in_progress", "failed", "expired"],
  awaiting_voice: ["in_progress", "processing", "failed", "expired"],
  in_progress: ["processing", "failed", "expired"],
  processing: ["completed", "failed", "expired"],
  failed: ["processing"],
  completed: [],
  expired: [],
};

export function canTransition(from: SessionStatus, to: SessionStatus) {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: SessionStatus, to: SessionStatus) {
  if (!canTransition(from, to)) throw new Error("SESSION_NOT_ACTIVE");
}

export const MIN_SCORABLE_USER_CHARS = 120;

export type TranscriptTurn = {
  speaker: "assistant" | "user";
  text: string;
  actor?: "student" | "coach" | "moderator" | "peer_a" | "peer_b";
  delivery?: "provider-final" | "sent";
};
export type Transcript = {
  raw: string;
  turns: TranscriptTurn[];
  parsed: boolean;
};

const SPEAKER_LINE = /^\s*(assistant|user)\s*:\s*(.*)$/i;
const FOREIGN_LABEL = /^\s*(system|tool|developer|function|analysis)\s*:/i;

export function parseTranscript(raw: string): Transcript {
  const text = raw.replace(/\r\n?/g, "\n").trim();
  if (!text) return { raw, turns: [], parsed: false };
  const turns: TranscriptTurn[] = [];
  let malformed = false;
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const match = SPEAKER_LINE.exec(line);
    if (match) {
      turns.push({
        speaker: match[1].toLowerCase() as TranscriptTurn["speaker"],
        text: match[2].trim(),
      });
      continue;
    }
    if (FOREIGN_LABEL.test(line)) {
      malformed = true;
      continue;
    }
    const last = turns[turns.length - 1];
    if (!last) {
      malformed = true;
      continue;
    }
    last.text = last.text ? `${last.text}\n${line.trim()}` : line.trim();
  }
  return {
    raw,
    turns,
    parsed:
      !malformed &&
      turns.length > 0 &&
      turns.every((turn) => turn.text.length > 0),
  };
}

export function transcriptReady(transcript: Transcript) {
  const userText = transcript.turns
    .filter((turn) => turn.speaker === "user")
    .map((turn) => turn.text)
    .join(" ")
    .replace(/\s+/g, " ");
  return (
    transcript.parsed &&
    transcript.turns.some((turn) => turn.speaker === "assistant") &&
    transcript.turns.some((turn) => turn.speaker === "user") &&
    userText.length >= MIN_SCORABLE_USER_CHARS
  );
}

export function calculateOverallScore(scores: readonly number[]) {
  if (
    !scores.length ||
    scores.some((score) => !Number.isInteger(score) || score < 1 || score > 5)
  ) {
    throw new Error("INVALID_DIMENSIONS");
  }
  const total = scores.reduce((sum, score) => sum + score, 0);
  // Scale integer points before dividing so 57.5 matches PostgreSQL's 58.
  return Math.round((total * 20) / scores.length);
}

export const scoreDimensionSchema = z
  .object({
    dimension: z.enum(SCORE_DIMENSIONS),
    score: z.number().int().min(1).max(5),
    reason: z.string().trim().min(20).max(500),
    evidenceQuote: z.string().trim().max(500).nullable(),
  })
  .strict();
export type DimensionScore = z.infer<typeof scoreDimensionSchema>;

export const momentSchema = z
  .object({
    title: z.string().trim().min(5).max(120),
    reason: z.string().trim().min(20).max(500),
    quote: z.string().trim().max(500).nullable(),
  })
  .strict();
export type Moment = z.infer<typeof momentSchema>;

export const practiceActionSchema = z
  .object({
    title: z.string().trim().min(5).max(120),
    detail: z.string().trim().min(20).max(400),
  })
  .strict();
export type PracticeAction = z.infer<typeof practiceActionSchema>;

export const scorecardModelSchema = z
  .object({
    overallScore: z.number().int().min(1).max(100),
    strongestMoment: momentSchema,
    weakestMoment: momentSchema,
    dimensions: z.array(scoreDimensionSchema).length(8),
    practiceActions: z.array(practiceActionSchema).length(3),
  })
  .strict();
export type ScorecardModel = z.infer<typeof scorecardModelSchema>;

export type Scorecard = {
  overallScore: number;
  strongestMoment: Moment;
  weakestMoment: Moment;
  dimensions: DimensionScore[];
  practiceActions: PracticeAction[];
};

function normalise(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function groundQuote(quote: string | null, pool: string[]) {
  if (quote === null) return null;
  const candidate = normalise(quote);
  if (!candidate) return null;
  if (candidate.length < 8 || !pool.some((turn) => turn.includes(candidate))) {
    throw new Error("UNGROUNDED_EVIDENCE");
  }
  return quote.trim();
}

export function validateScorecard(
  value: unknown,
  transcript: Transcript,
): Scorecard {
  if (!transcriptReady(transcript)) throw new Error("TRANSCRIPT_NOT_SCORABLE");
  const parsed = scorecardModelSchema.parse(value);
  if (
    new Set(parsed.dimensions.map((item) => item.dimension)).size !==
    SCORE_DIMENSIONS.length
  ) {
    throw new Error("INVALID_DIMENSIONS");
  }
  const userTurns = transcript.turns
    .filter((turn) => turn.speaker === "user")
    .map((turn) => normalise(turn.text));
  const dimensions = parsed.dimensions.map((item) => ({
    ...item,
    evidenceQuote: groundQuote(item.evidenceQuote, userTurns),
  }));
  return {
    overallScore: calculateOverallScore(dimensions.map((item) => item.score)),
    strongestMoment: {
      ...parsed.strongestMoment,
      quote: groundQuote(parsed.strongestMoment.quote, userTurns),
    },
    weakestMoment: {
      ...parsed.weakestMoment,
      quote: groundQuote(parsed.weakestMoment.quote, userTurns),
    },
    dimensions,
    practiceActions: parsed.practiceActions,
  };
}
