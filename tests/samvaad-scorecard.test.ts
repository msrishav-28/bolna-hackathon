import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import {
  SCORE_DIMENSIONS,
  calculateOverallScore,
  parseTranscript,
  validateScorecard,
} from "../src/lib/domain/samvaad";

const raw = [
  "assistant: What stops AI tools from becoming dependence?",
  "user: I believe AI tools help students learn faster",
  "when teachers require them to explain their process and defend their choices in class.",
].join("\n");
const transcript = parseTranscript(raw);
const quote = "AI tools help students learn faster";

function dimensions(scores = [4, 3, 4, 3, 4, 3, 4, 3]) {
  return SCORE_DIMENSIONS.map((dimension, index) => ({
    dimension,
    score: scores[index],
    reason: "This dimension has a clear evidence-based reason.",
    evidenceQuote: index % 2 === 0 ? quote : null,
  }));
}

function scorecard() {
  return {
    overallScore: 12,
    strongestMoment: {
      title: "Clear position up front",
      reason: "You stated a position before explaining the condition.",
      quote,
    },
    weakestMoment: {
      title: "Missing a concrete case",
      reason: "The argument needed one real classroom example.",
      quote: null,
    },
    dimensions: dimensions(),
    practiceActions: [
      {
        title: "Open with a claim",
        detail: "State your position in one sentence before supporting it.",
      },
      {
        title: "Add one example",
        detail: "Use a specific classroom or workplace case in every answer.",
      },
      {
        title: "Close the loop",
        detail: "End by naming the condition that makes your position work.",
      },
    ],
  };
}

describe("scorecard validation", () => {
  it("matches PostgreSQL percentage rounding for every eight-dimension total", async () => {
    const db = new PGlite();
    try {
      for (let total = 8; total <= 40; total++) {
        let remainder = total - 8;
        const scores = Array.from({ length: 8 }, () => {
          const extra = Math.min(4, remainder);
          remainder -= extra;
          return 1 + extra;
        });
        const result = await db.query<{ overall: number }>(
          "select round(avg(score)/5*100)::integer as overall from unnest($1::integer[]) as scores(score)",
          [scores],
        );
        expect(calculateOverallScore(scores), `dimension total ${total}`).toBe(
          result.rows[0].overall,
        );
      }
    } finally {
      await db.close();
    }
  }, 30000);
  it("accepts a complete scorecard and replaces the model overall score", () => {
    const result = validateScorecard(scorecard(), transcript);
    expect(result.overallScore).toBe(70);
    expect(result.dimensions).toHaveLength(8);
    expect(result.practiceActions).toHaveLength(3);
    expect(result.strongestMoment.quote).toBe(quote);
  });

  it("calculates the exact floor and ceiling", () => {
    expect(
      validateScorecard(
        { ...scorecard(), dimensions: dimensions(Array(8).fill(5)) },
        transcript,
      ).overallScore,
    ).toBe(100);
    expect(
      validateScorecard(
        { ...scorecard(), dimensions: dimensions(Array(8).fill(1)) },
        transcript,
      ).overallScore,
    ).toBe(20);
    expect(calculateOverallScore([4, 4, 4, 4, 3, 3, 3, 3])).toBe(70);
  });

  it("rejects duplicate, missing or unknown dimensions", () => {
    const duplicate = dimensions();
    duplicate[7] = { ...duplicate[0] };
    expect(() =>
      validateScorecard({ ...scorecard(), dimensions: duplicate }, transcript),
    ).toThrow("INVALID_DIMENSIONS");
    expect(() =>
      validateScorecard(
        { ...scorecard(), dimensions: dimensions().slice(0, 7) },
        transcript,
      ),
    ).toThrow();
    const unknown = dimensions();
    unknown[0] = { ...unknown[0], dimension: "confidence" as never };
    expect(() =>
      validateScorecard({ ...scorecard(), dimensions: unknown }, transcript),
    ).toThrow();
  });

  it("rejects out-of-range scores, non-integers and thin reasons", () => {
    for (const score of [0, 6, 3.5, NaN]) {
      const invalid = dimensions();
      invalid[0] = { ...invalid[0], score: score as never };
      expect(() =>
        validateScorecard({ ...scorecard(), dimensions: invalid }, transcript),
      ).toThrow();
    }
    const thin = dimensions();
    thin[0] = { ...thin[0], reason: "Too short." };
    expect(() =>
      validateScorecard({ ...scorecard(), dimensions: thin }, transcript),
    ).toThrow();
  });

  it("requires exactly three practice actions", () => {
    const actions = scorecard().practiceActions;
    expect(() =>
      validateScorecard(
        { ...scorecard(), practiceActions: actions.slice(0, 2) },
        transcript,
      ),
    ).toThrow();
    expect(() =>
      validateScorecard(
        { ...scorecard(), practiceActions: [...actions, actions[0]] },
        transcript,
      ),
    ).toThrow();
  });

  it("rejects invented quotes and quotes taken from the panel", () => {
    const invented = dimensions();
    invented[0] = {
      ...invented[0],
      evidenceQuote: "Students always learn better with AI.",
    };
    expect(() =>
      validateScorecard({ ...scorecard(), dimensions: invented }, transcript),
    ).toThrow("UNGROUNDED_EVIDENCE");
    expect(() =>
      validateScorecard(
        {
          ...scorecard(),
          strongestMoment: {
            ...scorecard().strongestMoment,
            quote: "What stops AI tools from becoming dependence?",
          },
        },
        transcript,
      ),
    ).toThrow("UNGROUNDED_EVIDENCE");
  });

  it("matches quotes across wrapped lines and treats blank quotes as null", () => {
    const wrapped = dimensions();
    wrapped[0] = {
      ...wrapped[0],
      evidenceQuote: "learn faster when teachers require them",
    };
    const blank = dimensions();
    blank[1] = { ...blank[1], evidenceQuote: "   " };
    const result = validateScorecard(
      {
        ...scorecard(),
        dimensions: wrapped.map((item, index) =>
          index === 1 ? blank[1] : item,
        ),
      },
      transcript,
    );
    expect(result.dimensions[1].evidenceQuote).toBeNull();
  });

  it("refuses to score an unready transcript", () => {
    expect(() =>
      validateScorecard(
        scorecard(),
        parseTranscript("assistant: Welcome.\nuser: Too short."),
      ),
    ).toThrow("TRANSCRIPT_NOT_SCORABLE");
    expect(() =>
      validateScorecard(scorecard(), { raw: "", turns: [], parsed: false }),
    ).toThrow("TRANSCRIPT_NOT_SCORABLE");
  });
});
