"use client";

import React, { useState } from "react";
import Link from "next/link";
import { PRESET_TOPICS, DIFFICULTY_LEVELS } from "@/lib/marketing-examples";
import { ScrollReveal } from "@/components/marketing/editorial-reveal";

const PRACTICE_FORMATS = [
  {
    id: "all",
    label: "All 5 Prompts",
    tag: "Full Catalogue",
  },
  {
    id: "gd",
    label: "Group Discussions",
    tag: "Placement GD",
  },
  {
    id: "viva",
    label: "Viva & Oral Defense",
    tag: "Academic Viva",
  },
  {
    id: "debate",
    label: "Debates",
    tag: "Policy Motion",
  },
  {
    id: "interview",
    label: "Interviews & Presentations",
    tag: "Panel Q&A",
  },
] as const;

const TOPIC_FORMAT_BADGES: Record<
  string,
  { formatLabel: string; formatGroup: string }
> = {
  "ai-assignments": {
    formatLabel: "Viva & Defense",
    formatGroup: "viva",
  },
  "remote-early-career": {
    formatLabel: "Placement GD",
    formatGroup: "gd",
  },
  "social-media-age": {
    formatLabel: "Policy Debate",
    formatGroup: "debate",
  },
  "internships-vs-classroom": {
    formatLabel: "Interview & Viva",
    formatGroup: "interview",
  },
  "india-ai-skills": {
    formatLabel: "Presentation & GD",
    formatGroup: "interview",
  },
};

export function LivePanelSimulator() {
  const [selectedSessionMinutes, setSelectedSessionMinutes] = useState<3 | 5>(
    3,
  );
  const [activeFormatFilter, setActiveFormatFilter] = useState<string>("all");

  const visibleTopics =
    activeFormatFilter === "all"
      ? PRESET_TOPICS
      : PRESET_TOPICS.filter(
          (t) => TOPIC_FORMAT_BADGES[t.id]?.formatGroup === activeFormatFilter,
        );

  return (
    <div className="flex flex-col gap-10">
      {/* Format Filter Pills (Interviews, Vivas, Debates, Group Discussions, Presentations) */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-stone/80">
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-graphite">
          <span className="inline-block w-2 h-2 rounded-full bg-clay" />
          <span>Filter by Student Speaking Format:</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PRACTICE_FORMATS.map((fmt) => {
            const active = activeFormatFilter === fmt.id;
            return (
              <button
                key={fmt.id}
                type="button"
                onClick={() => setActiveFormatFilter(fmt.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-sans border transition-all cursor-pointer flex items-center gap-2 ${
                  active
                    ? "bg-ink text-paper border-ink font-semibold"
                    : "bg-canvas text-ink border-stone hover:bg-oat/70"
                }`}
              >
                <span>{fmt.label}</span>
                <span
                  className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${
                    active ? "bg-clay text-paper" : "bg-oat text-graphite"
                  }`}
                >
                  {fmt.tag}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5 Discussion Topics Grid + 6th Repeat-Topic Mastery Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {visibleTopics.map((topic, idx) => {
          const formatMeta = TOPIC_FORMAT_BADGES[topic.id] ?? {
            formatLabel: "Group Discussion & Viva",
            formatGroup: "gd",
          };
          return (
            <ScrollReveal
              key={topic.id}
              delayMs={idx * 50}
              className="rounded-2xl bg-paper border border-stone p-5 sm:p-6 flex flex-col justify-between gap-5 hover:border-ink transition-all duration-300 group"
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2 text-[11px] font-mono uppercase tracking-wider text-ashen">
                  <span className="whitespace-nowrap">
                    {topic.order} · {topic.category}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-oat text-ink font-semibold text-[10px] whitespace-nowrap">
                    {formatMeta.formatLabel}
                  </span>
                </div>

                <h3 className="font-serif text-lg sm:text-xl font-semibold text-ink leading-snug group-hover:text-clay transition-colors">
                  {topic.title}
                </h3>

                <p className="text-xs sm:text-sm font-sans text-graphite leading-relaxed">
                  {topic.context}
                </p>
              </div>

              <div className="flex flex-col gap-3 pt-3 border-t border-stone">
                <div className="bg-canvas rounded-xl p-3.5 border border-stone/80">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-clay font-semibold block mb-1">
                    Adaptive Panel Pushback
                  </span>
                  <p className="font-serif text-xs sm:text-sm text-ink italic leading-snug">
                    &ldquo;{topic.interruptionCue}&rdquo;
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] font-mono text-ashen whitespace-nowrap">
                    {selectedSessionMinutes}-Min · 8 Rubrics
                  </span>
                  <Link
                    href={`/practice?topic=${topic.id}`}
                    className="text-xs font-sans font-semibold text-ink group-hover:text-clay editorial-link whitespace-nowrap"
                  >
                    Practice prompt →
                  </Link>
                </div>
              </div>
            </ScrollReveal>
          );
        })}

        {/* Final Card: Track Progress Across Repeat Attempts */}
        <ScrollReveal
          delayMs={240}
          className="rounded-2xl bg-inversion text-paper border border-ink p-5 sm:p-6 flex flex-col justify-between gap-5"
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-cloud">
              <span>REPEAT-TOPIC MASTERY</span>
              <span className="text-clay font-semibold">SCORE DELTA</span>
            </div>

            <h3 className="font-serif text-xl sm:text-2xl font-semibold text-paper leading-snug">
              Measure how much sharper your second attempt sounds.
            </h3>

            <p className="text-xs sm:text-sm font-sans text-cloud leading-relaxed">
              Every session saves your 8-dimension rubric breakdown and 3
              actionable adjustments. Repeat the exact same interview, viva, or
              GD topic to track your readiness gain from Attempt #1 to Attempt
              #2.
            </p>
          </div>

          <div className="flex flex-col gap-3 pt-3 border-t border-paper/15">
            <div className="rounded-xl bg-paper/10 p-3.5 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-cloud">
                  ILLUSTRATIVE COMPARISON · SYNTHETIC SCORES
                </div>
                <div className="font-serif text-lg font-semibold text-paper">
                  64/100 → 79/100
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-clay text-paper font-mono text-xs font-semibold">
                +15 pts
              </span>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] font-mono text-cloud">
                Compare the same topic and rubric
              </span>
              <Link
                href="/practice?view=history"
                className="text-xs font-sans font-semibold text-clay hover:text-paper transition-colors underline underline-offset-4"
              >
                Inspect Progress Log →
              </Link>
            </div>
          </div>
        </ScrollReveal>
      </div>

      {/* Redesigned Three Pressure Levels + 3- or 5-Minute Calibration Folio */}
      <ScrollReveal
        delayMs={80}
        className="rounded-3xl bg-manilla border border-stone p-6 sm:p-8 lg:p-10 flex flex-col gap-8"
      >
        {/* Top Row: Editorial Heading + Interactive 3-Min / 5-Min Session Format Switcher */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start lg:items-end pb-6 border-b border-stone/80">
          <div className="lg:col-span-7 min-w-0 flex flex-col gap-2.5">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-clay font-semibold">
              <span className="inline-block w-2 h-2 rounded-full bg-clay" />
              <span>THREE PRESSURE LEVELS · 3- OR 5-MINUTE SESSIONS</span>
            </div>
            <h3 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold text-ink tracking-tight leading-tight text-balance">
              Start with patient turn-taking, then work up to live panel
              cross-examination.
            </h3>
            <p className="text-sm sm:text-base font-sans text-graphite leading-relaxed max-w-2xl">
              Calibrate how quickly the panel steps in when your argument
              drifts, and choose between a focused 3-minute sprint or an
              extended 5-minute defense for interviews, vivas, debates, and
              group discussions.
            </p>
          </div>

          {/* Right 5 Cols: Interactive 3-Min vs 5-Min Session Architecture Card */}
          <div className="lg:col-span-5 min-w-0 w-full rounded-2xl bg-paper border border-stone p-4 sm:p-5 flex flex-col gap-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-graphite font-semibold whitespace-nowrap">
                SESSION CLOCK
              </span>
              <div className="inline-flex flex-wrap items-center bg-oat p-1 rounded-xl border border-stone min-w-0">
                <button
                  type="button"
                  onClick={() => setSelectedSessionMinutes(3)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors cursor-pointer whitespace-nowrap ${
                    selectedSessionMinutes === 3
                      ? "bg-ink text-paper font-semibold"
                      : "text-graphite hover:text-ink"
                  }`}
                >
                  3-Min Sprint
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSessionMinutes(5)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors cursor-pointer whitespace-nowrap ${
                    selectedSessionMinutes === 5
                      ? "bg-ink text-paper font-semibold"
                      : "text-graphite hover:text-ink"
                  }`}
                >
                  5-Min Defense
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="rounded-xl bg-canvas border border-stone/80 p-2.5">
                <div className="text-[10px] font-mono uppercase text-ashen whitespace-nowrap">
                  01 · Opening
                </div>
                <div className="font-serif text-xs sm:text-sm font-semibold text-ink mt-0.5 whitespace-nowrap">
                  {selectedSessionMinutes === 3 ? "0:00–0:40" : "0:00–1:00"}
                </div>
                <div className="text-[11px] font-sans text-graphite mt-0.5">
                  Core thesis
                </div>
              </div>
              <div className="rounded-xl bg-canvas border border-stone/80 p-2.5">
                <div className="text-[10px] font-mono uppercase text-clay font-semibold whitespace-nowrap">
                  02 · Probes
                </div>
                <div className="font-serif text-xs sm:text-sm font-semibold text-ink mt-0.5 whitespace-nowrap">
                  {selectedSessionMinutes === 3 ? "1–2 Cut-Ins" : "2–3 Cut-Ins"}
                </div>
                <div className="text-[11px] font-sans text-graphite mt-0.5">
                  Live pushback
                </div>
              </div>
              <div className="rounded-xl bg-canvas border border-stone/80 p-2.5">
                <div className="text-[10px] font-mono uppercase text-ashen whitespace-nowrap">
                  03 · Verdict
                </div>
                <div className="font-serif text-xs sm:text-sm font-semibold text-ink mt-0.5 whitespace-nowrap">
                  8 Rubrics
                </div>
                <div className="text-[11px] font-sans text-graphite mt-0.5">
                  3 next actions
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Row: 3 Equal-Width Pressure Level Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          {DIFFICULTY_LEVELS.map((d, index) => {
            const isIntense = d.id === "Intense";
            const badgeText =
              d.id === "Gentle"
                ? "35–45s Grace"
                : d.id === "Standard"
                  ? "20–30s Probe"
                  : "Direct Cut-In";
            const idealFor =
              d.id === "Gentle"
                ? "First-time viva, interview warmups & structured openings"
                : d.id === "Standard"
                  ? "Campus placement GDs, case presentations & panel interviews"
                  : "High-stakes policy debates, thesis defense & stress interviews";

            return (
              <div
                key={d.id}
                className={`rounded-2xl p-5 sm:p-6 border flex flex-col justify-between gap-4 ${
                  isIntense ? "bg-paper border-ink/40" : "bg-paper border-stone"
                }`}
              >
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono uppercase tracking-wider text-clay font-semibold whitespace-nowrap">
                      LEVEL 0{index + 1}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-oat text-[11px] font-mono text-ink font-medium whitespace-nowrap">
                      {badgeText}
                    </span>
                  </div>

                  <h4 className="font-serif text-xl font-bold text-ink">
                    {d.label}
                  </h4>

                  <p className="text-xs sm:text-sm font-sans text-graphite leading-relaxed">
                    {d.cadence} {d.description}
                  </p>
                </div>

                <div className="pt-3.5 border-t border-stone/80 flex flex-col gap-2.5">
                  <div className="text-[11px] font-mono text-ashen leading-snug">
                    <strong className="text-ink font-semibold">
                      Best for:
                    </strong>{" "}
                    {idealFor}
                  </div>
                  <Link
                    href={`/practice?difficulty=${d.id}`}
                    className="inline-flex items-center justify-between px-3.5 py-2 rounded-xl bg-canvas hover:bg-ink hover:text-paper border border-stone text-xs font-sans font-semibold text-ink transition-colors"
                  >
                    <span>Start {d.label} Session</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollReveal>
    </div>
  );
}
