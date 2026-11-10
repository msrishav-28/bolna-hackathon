"use client";

import React, { useState } from "react";
import Link from "next/link";

const FAQ_ITEMS = [
  {
    q: "How is Samvaad different from practicing with a standard AI voice assistant?",
    a: "General AI assistants are trained to be agreeable and wait politely until you finish speaking—even if you ramble for two minutes. Samvaad is built specifically for group discussions: it tracks your structure, challenges unbacked claims, and interrupts you mid-thought when your argument drifts.",
  },
  {
    q: "Why are there no live captions or live score meters while I am speaking?",
    a: "In a real placement or policy discussion, you cannot read a screen full of rolling text while defending your point. The live room stays intentionally quiet so you focus entirely on listening, yielding cleanly when interrupted, and delivering a structured recovery.",
  },
  {
    q: "Does Samvaad store recordings of my voice?",
    a: "No raw voice audio is stored after your session. Samvaad evaluates the conversation transcript to generate your eight-dimension scorecard and three practice actions, keeping your practice history private to your account.",
  },
  {
    q: "How is my Overall Readiness score calculated?",
    a: "Each dimension is scored from 1 to 5: clarity, structure, relevance, evidence, counterargument handling, conciseness, composure and closing. The total is calculated from their average. Composure refers to the response visible in the transcript, not an inference about your voice or emotions.",
  },
  {
    q: "What is the fastest way to improve my score before a campus placement GD?",
    a: "Pick one topic, complete a 3-minute Standard session, read your three practice actions, and practise again. Compare attempts on the same topic, mode and rubric. Improvement varies; the sample scores on this page are illustrations, not measured student outcomes.",
  },
];

export function ArchitectureTrustFolio() {
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);

  return (
    <div className="flex flex-col">
      {/* Coaching Philosophy & Three Panel Roles */}
      <section
        id="how-it-works"
        aria-labelledby="personas-heading"
        className="py-14 sm:py-20 lg:py-24 border-b border-stone bg-paper"
      >
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-12 items-end">
            <div className="lg:col-span-7">
              <div className="text-xs font-mono uppercase tracking-wider text-clay font-semibold mb-2 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-clay" />
                <span>HOW THE PANEL TRAINS YOU</span>
              </div>
              <h2
                id="personas-heading"
                className="font-serif text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-ink leading-[1.1] text-balance"
              >
                Challenged, not humiliated. Direct, never harsh.
              </h2>
            </div>
            <div className="lg:col-span-5">
              <p className="font-sans text-sm sm:text-base text-graphite leading-relaxed">
                Samvaad combines a calm coach who tells you the truth with a
                sharp debate partner who never lets a vague claim pass. Every
                interruption is designed to teach you how to yield, pivot, and
                answer with precision.
              </p>
            </div>
          </div>

          {/* 3 Roles + Visual Plate */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-3xl bg-canvas border border-stone p-6 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-mono uppercase tracking-wider text-ashen">
                    01 · OPENING & TIME
                  </span>
                  <h3 className="font-serif text-xl font-semibold text-ink mt-2 mb-3">
                    Moderator
                  </h3>
                  <p className="font-sans text-sm text-graphite leading-relaxed">
                    Introduces the discussion prompt, sets your opening time
                    boundary, keeps the session clock honest, and closes the
                    round cleanly.
                  </p>
                </div>
                <div className="pt-5 mt-5 border-t border-stone text-xs font-serif italic text-ink">
                  &ldquo;State your opening position in under forty
                  seconds.&rdquo;
                </div>
              </div>

              <div className="rounded-3xl bg-canvas border border-stone p-6 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-mono uppercase tracking-wider text-ashen">
                    02 · DEPTH PROBE
                  </span>
                  <h3 className="font-serif text-xl font-semibold text-ink mt-2 mb-3">
                    Supporter
                  </h3>
                  <p className="font-sans text-sm text-graphite leading-relaxed">
                    Recognizes when you formulate a crisp conditional argument
                    and asks you to push the real-world mechanism one layer
                    deeper.
                  </p>
                </div>
                <div className="pt-5 mt-5 border-t border-stone text-xs font-serif italic text-ink">
                  &ldquo;That distinction is clear. Push it one step
                  further.&rdquo;
                </div>
              </div>

              <div className="rounded-3xl bg-manilla border border-stone p-6 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-mono uppercase tracking-wider text-clay font-semibold">
                    03 · COUNTER-PRESSURE
                  </span>
                  <h3 className="font-serif text-xl font-semibold text-ink mt-2 mb-3">
                    Challenger
                  </h3>
                  <p className="font-sans text-sm text-ink leading-relaxed">
                    Disagrees with unbacked premises, demands concrete evidence,
                    and interrupts when you repeat the same idea twice.
                  </p>
                </div>
                <div className="pt-5 mt-5 border-t border-ink/20 text-xs font-serif italic text-ink font-semibold">
                  &ldquo;Let me stop you there. What is your core point?&rdquo;
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 rounded-3xl bg-canvas border border-stone p-6 flex flex-col justify-between gap-4">
              <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-ashen">
                <span>DYNAMIC PANEL POSTURE</span>
                <span>3 ROLES IN 1 ROOM</span>
              </div>
              <p className="font-sans text-xs sm:text-sm text-graphite leading-relaxed">
                During a single 3- or 5-minute session, the panel shifts posture
                based on your clarity—giving you space when your reasoning is
                tight and stepping in when you drift.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section
        id="faq"
        aria-labelledby="faq-heading"
        className="py-14 sm:py-20 lg:py-24 bg-canvas"
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-xs font-mono uppercase tracking-wider text-clay font-semibold mb-2">
            FREQUENTLY ASKED QUESTIONS
          </div>
          <h2
            id="faq-heading"
            className="font-serif text-2xl sm:text-4xl font-bold text-ink mb-8"
          >
            Everything you need to know before your first session.
          </h2>
          <div className="flex flex-col gap-3">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openFaqIdx === idx;
              return (
                <div
                  key={item.q}
                  className={`rounded-2xl border transition-all duration-200 px-5 sm:px-6 py-4 ${
                    isOpen
                      ? "bg-manilla/55 border-ink/30 shadow-2xs"
                      : "bg-paper border-stone hover:border-ink/40"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between gap-4 text-left font-serif text-base sm:text-lg font-semibold text-ink cursor-pointer"
                  >
                    <div className="flex items-baseline gap-3">
                      <span className="text-xs font-mono text-clay font-semibold shrink-0">
                        0{idx + 1}
                      </span>
                      <span>{item.q}</span>
                    </div>
                    <span
                      className={`w-7 h-7 rounded-xl border flex items-center justify-center shrink-0 transition-all duration-200 ${
                        isOpen
                          ? "bg-ink text-paper border-ink rotate-180"
                          : "bg-oat text-ink border-stone"
                      }`}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M2.5 4.5L6 8L9.5 4.5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </button>
                  {isOpen && (
                    <p className="mt-3 pl-7 font-sans text-sm sm:text-base text-graphite leading-relaxed pr-4 border-t border-stone/70 pt-3">
                      {item.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-10 rounded-3xl bg-manilla border border-stone p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-serif text-xl sm:text-2xl font-semibold text-ink">
                Ready to test your opening argument?
              </h3>
              <p className="text-xs sm:text-sm font-sans text-graphite mt-1">
                Pick a topic, check your microphone and practise. Available
                modes and session allowance appear in your practice workspace.
              </p>
            </div>
            <Link
              href="/practice"
              className="btn-clay-tab px-5 py-3 text-xs sm:text-sm font-sans font-semibold shrink-0 text-center"
            >
              Start Practicing →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
