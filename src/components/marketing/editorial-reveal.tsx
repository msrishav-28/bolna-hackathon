"use client";

import React, { useEffect, useState } from "react";

interface WordRevealProps {
  text: string;
  className?: string;
  as?: "h1" | "h2" | "h3" | "p" | "blockquote" | "span";
  staggerMs?: number;
  highlightWords?: string[];
  underlineWords?: string[];
  replayTrigger?: number;
}

export function WordReveal({
  text,
  className = "",
  as: Tag = "h2",
  staggerMs = 36,
  highlightWords = [],
  underlineWords = [],
  replayTrigger = 0,
}: WordRevealProps) {
  const words = text.split(" ");

  return (
    <Tag key={replayTrigger} className={className}>
      {words.map((word, idx) => {
        const cleanWord = word.replace(/[.,;!?—]/g, "").toLowerCase();
        const isHighlighted = highlightWords.some(
          (w) => w.toLowerCase() === cleanWord,
        );
        const isUnderlined = underlineWords.some(
          (w) => w.toLowerCase() === cleanWord,
        );

        return (
          <span
            key={`${word}-${idx}`}
            style={{
              animationDelay: `${idx * staggerMs}ms`,
            }}
            className={`inline-block animate-word-rise mr-[0.26em] last:mr-0 ${
              isHighlighted ? "text-clay italic font-serif font-normal" : ""
            } ${isUnderlined ? "editorial-link" : ""}`}
          >
            {word}
          </span>
        );
      })}
    </Tag>
  );
}

export function ScrollReveal({
  children,
  className = "",
  delayMs = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
}) {
  return (
    <div
      style={{
        animationDelay: `${delayMs}ms`,
      }}
      className={className}
    >
      {children}
    </div>
  );
}

export function AnimatedNumber({
  value,
  durationMs = 900,
  decimals = 0,
  prefix = "",
  suffix = "",
}: {
  value: number;
  durationMs?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
}) {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let start: number | null = null;
    let rafId = 0;

    const step = (ts: number) => {
      if (start === null) start = ts;
      const progress = Math.min((ts - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(value * eased);
      if (progress < 1) {
        rafId = window.requestAnimationFrame(step);
      }
    };

    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [value, durationMs]);

  return (
    <span>
      {prefix}
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
}

interface LiveDialogueLoopItem {
  topicTag: string;
  studentRamble: string;
  challengerBargeIn: string;
  studentRecovery: string;
}

const LIVE_LOOP_ITEMS: LiveDialogueLoopItem[] = [
  {
    topicTag: "AI in Assignments",
    studentRamble:
      "“Colleges should allow AI tools because every software company already uses them and banning them feels outdated—”",
    challengerBargeIn:
      "Let me stop you there. That is workplace convenience, not learning proof.",
    studentRecovery:
      "“Fair pushback. Restrict AI in year-one labs; allow it only in upper-level design courses with oral defense.”",
  },
  {
    topicTag: "Remote Early Career",
    studentRamble:
      "“Remote work is much better for fresh graduates because commuting wastes two hours a day and people focus better—”",
    challengerBargeIn:
      "Hold on. Saved commute time is convenience. How do you replace tacit senior mentorship?",
    studentRecovery:
      "“You cannot replace it passively—remote only works for juniors if teams mandate daily 30-minute pairing.”",
  },
  {
    topicTag: "Age Verification",
    studentRamble:
      "“Mandatory age verification is essential because algorithms maximize screen time and teenagers are vulnerable—”",
    challengerBargeIn:
      "Let me stop you there. Does your proposal force every adult to upload a government ID?",
    studentRecovery:
      "“No raw ID uploads. Enforce zero-knowledge device-wallet age tokens so platforms only receive a binary proof.”",
  },
];

export function HeroInterruptionDemo() {
  const [itemIdx, setItemIdx] = useState(0);
  const [phase, setPhase] = useState<"typing" | "interrupted" | "recovered">(
    "recovered",
  );

  const current = LIVE_LOOP_ITEMS[itemIdx];

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      setPhase((prev) => {
        if (prev === "typing") return "interrupted";
        if (prev === "interrupted") return "recovered";
        return "typing";
      });
    }, 3200);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="rounded-2xl bg-paper border border-stone p-4 sm:p-5 flex flex-col gap-3">
      {/* Header Row with Topic Switcher Pills */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-stone/70">
        <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-ink font-semibold">
          <span className="inline-block w-2 h-2 rounded-full bg-clay" />
          <span>SYNTHETIC EXAMPLE EXCHANGE</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {LIVE_LOOP_ITEMS.map((item, idx) => (
            <button
              key={item.topicTag}
              type="button"
              onClick={() => {
                setItemIdx(idx);
                setPhase("recovered");
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-sans transition-colors cursor-pointer ${
                idx === itemIdx
                  ? "bg-ink text-paper font-semibold"
                  : "bg-oat/70 text-graphite hover:text-ink"
              }`}
            >
              {item.topicTag}
            </button>
          ))}
        </div>
      </div>

      {/* All 3 turns remain mounted at fixed height so the layout never jumps or shifts */}
      <div className="grid grid-cols-1 gap-2.5">
        {/* Step 1: Candidate Ramble */}
        <div
          className={`rounded-xl p-3 border transition-colors duration-300 ${
            phase === "typing"
              ? "bg-canvas border-ink/40"
              : "bg-canvas/60 border-stone/70"
          }`}
        >
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-ashen mb-1">
            <span>01 · Candidate Opening (Broad Claim)</span>
            <span>00:14</span>
          </div>
          <p className="font-serif text-xs sm:text-sm text-graphite leading-snug line-through decoration-clay/60">
            {current.studentRamble}
          </p>
        </div>

        {/* Step 2: Challenger Barge-In */}
        <div
          className={`rounded-xl p-3 border-l-2 border-clay transition-colors duration-300 ${
            phase === "interrupted" ? "bg-manilla" : "bg-manilla/70"
          }`}
        >
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-clay font-semibold mb-1">
            <span>02 · Panel · Challenger Interruption</span>
            <span>00:42</span>
          </div>
          <p className="font-serif text-xs sm:text-sm text-ink font-medium leading-snug">
            &ldquo;{current.challengerBargeIn}&rdquo;
          </p>
        </div>

        {/* Step 3: Candidate Recovery */}
        <div
          className={`rounded-xl p-3 border transition-colors duration-300 ${
            phase === "recovered"
              ? "bg-oat border-ink/30"
              : "bg-oat/60 border-stone"
          }`}
        >
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-ink font-semibold mb-1">
            <span>03 · Candidate Recovery (Composure 4/5)</span>
            <span>00:56</span>
          </div>
          <p className="font-serif text-xs sm:text-sm text-ink leading-snug">
            {current.studentRecovery}
          </p>
        </div>
      </div>
    </div>
  );
}

export const HeroKineticInterruptionLoop = HeroInterruptionDemo;
