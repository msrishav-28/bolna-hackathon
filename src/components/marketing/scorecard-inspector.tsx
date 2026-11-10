"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  PRACTICE_ACTIONS,
  SCORED_DIMENSIONS,
  SYNTHETIC_TRANSCRIPT,
} from "@/lib/marketing-examples";
import { AnimatedNumber } from "@/components/marketing/editorial-reveal";

export function ScorecardInspector() {
  const [selectedDimensionId, setSelectedDimensionId] =
    useState<string>("conciseness");

  const selectedDimension =
    SCORED_DIMENSIONS.find((d) => d.id === selectedDimensionId) ??
    SCORED_DIMENSIONS[0];

  const scoreValues = SCORED_DIMENSIONS.map((d) => d.score);
  const sum = scoreValues.reduce((acc, v) => acc + v, 0);
  const average = sum / SCORED_DIMENSIONS.length;
  const calculatedOverall = Math.round((average / 5) * 100);

  return (
    <section
      id="scorecard-specimen"
      aria-labelledby="scorecard-heading"
      className="py-14 sm:py-20 lg:py-24 border-b border-stone bg-canvas"
    >
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-10 items-end">
          <div className="lg:col-span-7">
            <div className="text-xs font-mono uppercase tracking-wider text-clay font-semibold mb-2 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-clay" />
              <span>EVIDENCE-FIRST SCORECARD</span>
            </div>
            <h2
              id="scorecard-heading"
              className="font-serif text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-ink leading-[1.1] text-balance"
            >
              Eight dimensions. Grounded in your exact words.
            </h2>
          </div>
          <div className="lg:col-span-5">
            <p className="font-sans text-sm sm:text-base text-graphite leading-relaxed">
              Samvaad evaluates what you actually said and how you handled
              pushback—grounding feedback in the evidence from your discussion
              transcript. Click any dimension below to trace the exact moment in
              the conversation.
            </p>
          </div>
        </div>

        {/* Main Scorecard Dual Folio */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left 7 Cols: Overall Score + 8 Dimensions Grid */}
          <div className="lg:col-span-7 min-w-0 flex flex-col gap-6">
            {/* Top Overall Readiness Banner */}
            <div className="rounded-3xl bg-manilla border border-stone p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 text-[11px] font-mono uppercase tracking-wider bg-ink text-paper rounded-sm font-semibold">
                    SAMPLE SESSION REPORT
                  </span>
                  <span className="text-xs font-mono text-graphite">
                    AI in Assignments · Standard · 3 Min
                  </span>
                </div>
                <h3 className="font-serif text-2xl sm:text-3xl font-semibold text-ink">
                  Overall Discussion Readiness
                </h3>
                <p className="text-xs sm:text-sm font-sans text-graphite max-w-md leading-relaxed">
                  Calculated directly from your eight rubric dimensions, plus
                  three focused adjustments you can apply immediately on your
                  next attempt.
                </p>
                <div className="pt-1">
                  <Link
                    href="/practice?topic=ai-assignments"
                    className="btn-clay-tab inline-flex items-center gap-1.5 px-4 py-2 text-xs font-sans font-semibold"
                  >
                    <span>Practice This Topic Now →</span>
                  </Link>
                </div>
              </div>

              <div className="bg-paper rounded-2xl border border-stone p-5 text-center shrink-0 min-w-[165px]">
                <div className="text-xs font-mono uppercase tracking-wider text-ashen">
                  READINESS SCORE
                </div>
                <div className="font-serif text-5xl font-bold text-ink my-1">
                  <AnimatedNumber value={calculatedOverall} durationMs={1100} />
                  <span className="text-xl text-ashen font-normal">/100</span>
                </div>
                <div className="text-[11px] font-mono text-graphite">
                  Avg {average.toFixed(2)} / 5.00 ({sum}/40 pts)
                </div>
              </div>
            </div>

            {/* 8 Dimensions Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {SCORED_DIMENSIONS.map((dim) => {
                const active = dim.id === selectedDimensionId;
                return (
                  <button
                    key={dim.id}
                    type="button"
                    onClick={() => setSelectedDimensionId(dim.id)}
                    className={`rounded-2xl p-5 border text-left transition-all cursor-pointer ${
                      active
                        ? "bg-paper border-ink ring-1 ring-ink"
                        : "bg-paper/70 border-stone hover:bg-paper"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h4 className="font-serif text-base font-semibold text-ink">
                          {dim.name}
                        </h4>
                        <p className="text-xs font-sans text-ashen">
                          {dim.plainLabel}
                        </p>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-md font-mono text-xs font-semibold ${
                          dim.score >= 4
                            ? "bg-oat text-ink"
                            : dim.score === 3
                              ? "bg-manilla text-ink"
                              : "bg-clay text-paper"
                        }`}
                      >
                        {dim.score} / 5
                      </span>
                    </div>

                    <div className="flex items-center gap-1 my-2.5">
                      {[1, 2, 3, 4, 5].map((bar) => (
                        <span
                          key={bar}
                          className={`h-1.5 flex-1 rounded-full ${
                            bar <= dim.score ? "bg-ink" : "bg-stone/60"
                          }`}
                        />
                      ))}
                    </div>

                    <p className="font-sans text-xs sm:text-sm text-graphite leading-snug line-clamp-2">
                      {dim.reason}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Selected Dimension Deep-Dive Card */}
            <div className="rounded-3xl bg-paper border border-stone p-6 flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-ashen">
                <span>
                  SELECTED DIMENSION · {selectedDimension.name.toUpperCase()} (
                  {selectedDimension.score}/5)
                </span>
                <span>
                  TRANSCRIPT TURN: {selectedDimension.turnId ?? "N/A"}
                </span>
              </div>
              <p className="font-serif text-base sm:text-lg text-ink leading-relaxed">
                {selectedDimension.reason}
              </p>
              {selectedDimension.groundedQuote && (
                <div className="bg-manilla/70 border-l-2 border-clay p-3.5 rounded-r-xl">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-graphite mb-1">
                    Your Spoken Words:
                  </div>
                  <p className="font-serif text-sm sm:text-base italic text-ink">
                    &ldquo;{selectedDimension.groundedQuote}&rdquo;
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right 5 Cols: Strongest/Weakest Moments + 3 Actions + Verbatim Transcript */}
          <div className="lg:col-span-5 min-w-0 flex flex-col gap-6">
            {/* Strongest & Weakest Moments */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
              <div className="rounded-2xl bg-paper border border-stone p-5">
                <div className="text-xs font-mono uppercase tracking-wider text-ink font-semibold mb-1.5 flex items-center justify-between">
                  <span>Strongest Moment</span>
                  <span className="text-ashen">00:56</span>
                </div>
                <p className="font-serif text-sm sm:text-base text-ink leading-snug">
                  You conceded the Challenger&apos;s debugging-fundamentals
                  point immediately and narrowed your policy to upper-level
                  architecture courses instead of repeating your opening
                  premise.
                </p>
              </div>

              <div className="rounded-2xl bg-paper border border-stone p-5">
                <div className="text-xs font-mono uppercase tracking-wider text-clay font-semibold mb-1.5 flex items-center justify-between">
                  <span>Moment That Triggered Interruption</span>
                  <span className="text-ashen">00:14</span>
                </div>
                <p className="font-serif text-sm sm:text-base text-ink leading-snug">
                  Your opening turn asserted &ldquo;every company uses
                  them&rdquo; and stacked a second clause without stating a
                  learning mechanism, prompting the panel to step in at 00:42.
                </p>
              </div>
            </div>

            {/* Three Practice Actions */}
            <div className="rounded-3xl bg-oat border border-stone p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-ink font-semibold">
                  Three Practice Actions for Your Next Run
                </span>
                <span className="text-xs font-mono text-graphite">
                  Targeted Coaching
                </span>
              </div>

              <div className="flex flex-col gap-3">
                {PRACTICE_ACTIONS.map((act) => (
                  <div
                    key={act.number}
                    className="bg-paper rounded-2xl p-4 border border-stone"
                  >
                    <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-ashen mb-1">
                      <span className="text-clay font-semibold">
                        {act.number}
                      </span>
                      <span>{act.dimension}</span>
                    </div>
                    <h4 className="font-serif text-sm font-semibold text-ink mb-1">
                      {act.title}
                    </h4>
                    <p className="font-sans text-xs sm:text-sm text-graphite leading-relaxed">
                      {act.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Session Transcript */}
            <div className="rounded-3xl bg-paper border border-stone p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-stone pb-3">
                <div>
                  <span className="text-xs font-mono uppercase tracking-wider text-ink font-semibold block">
                    Session Transcript
                  </span>
                  <span className="text-xs font-sans text-ashen">
                    Click any rubric card to highlight the matching turn
                  </span>
                </div>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-canvas border border-stone text-graphite">
                  7 Turns
                </span>
              </div>

              <div className="flex flex-col gap-3">
                {SYNTHETIC_TRANSCRIPT.map((turn) => {
                  const isReferenced =
                    selectedDimension.turnId === turn.id ||
                    turn.dimensionRefs?.includes(selectedDimension.id);

                  return (
                    <div
                      key={turn.id}
                      className={`p-3.5 rounded-2xl border text-left transition-all ${
                        isReferenced
                          ? "bg-manilla border-clay"
                          : turn.isInterruption
                            ? "bg-oat/60 border-stone"
                            : "bg-canvas/60 border-stone/70"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider mb-1">
                        <span className="font-semibold text-ink">
                          {turn.speaker}
                          {turn.roleTag ? ` · ${turn.roleTag}` : ""}
                          {turn.isInterruption ? " [INTERRUPTION]" : ""}
                        </span>
                        <span className="text-ashen">{turn.timestamp}</span>
                      </div>
                      <p className="font-serif text-sm text-ink leading-relaxed">
                        {turn.text}
                      </p>
                      {isReferenced && (
                        <div className="mt-2 text-[11px] font-mono text-clay font-semibold">
                          ↑ Evidence for {selectedDimension.name}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
