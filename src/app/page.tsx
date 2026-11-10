import React from "react";
import Link from "next/link";
import { WordGlobeHero } from "@/components/marketing/word-globe-hero";
import { LivePanelSimulator } from "@/components/marketing/live-panel-simulator";
import { ScorecardInspector } from "@/components/marketing/scorecard-inspector";
import { ArchitectureTrustFolio } from "@/components/marketing/architecture-trust-folio";

import {
  ScrollReveal,
  HeroInterruptionDemo,
  AnimatedNumber,
} from "@/components/marketing/editorial-reveal";

export default function SamvaadHomePage() {
  return (
    <div className="min-h-screen w-full overflow-x-clip flex flex-col bg-canvas text-ink selection:bg-clay selection:text-paper">
      {/* Shared Top Navigation */}

      <main id="main" tabIndex={-1} className="flex-1">
        {/* Hero Section */}
        <section
          aria-labelledby="hero-heading"
          className="pt-8 pb-14 sm:pt-12 sm:pb-20 lg:pt-14 lg:pb-24 border-b border-stone"
        >
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
              {/* Left 7 Columns: Editorial Headline + Interruption Preview + CTAs */}
              <div className="lg:col-span-7 min-w-0 flex flex-col gap-5">
                <div className="inline-flex items-center gap-2.5 self-start px-3.5 py-1.5 rounded-full bg-manilla border border-stone text-xs font-mono uppercase tracking-wider text-ink">
                  <span className="inline-block w-2 h-2 rounded-full bg-clay animate-pulse" />
                  <span>
                    Voice Practice Partner · Interviews · Vivas · Debates · GDs
                  </span>
                </div>

                <h1
                  id="hero-heading"
                  className="font-serif text-4xl sm:text-5xl lg:text-[60px] font-bold tracking-tight text-ink leading-[1.05] text-balance"
                >
                  Practice the moment{" "}
                  <span className="italic font-normal text-clay">
                    before you speak.
                  </span>
                </h1>

                <p className="font-sans text-base sm:text-lg text-graphite leading-relaxed max-w-2xl text-pretty">
                  A voice practice partner for students preparing for{" "}
                  <strong className="text-ink font-semibold">
                    interviews, vivas, debates, group discussions, and
                    presentations
                  </strong>
                  —with adaptive questions, realistic mid-sentence
                  interruptions, and actionable feedback across eight rubric
                  dimensions.
                </p>

                {/* Student Speaking Formats Pill Bar */}
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    "Placement GDs",
                    "Interviews",
                    "Viva Voce",
                    "Policy Debates",
                    "Presentations",
                  ].map((format) => (
                    <span
                      key={format}
                      className="px-3 py-1 rounded-lg bg-paper border border-stone text-xs font-mono text-graphite"
                    >
                      {format}
                    </span>
                  ))}
                </div>

                {/* Live Interruption & Recovery Dialogue Preview */}
                <HeroInterruptionDemo />

                {/* Primary CTAs */}
                <div className="pt-1 flex flex-wrap items-center gap-3">
                  <Link
                    href="/practice"
                    className="btn-clay-tab px-6 py-3.5 text-sm sm:text-base font-sans font-semibold inline-flex items-center gap-2"
                  >
                    <span>Start a Practice Session</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                  <a
                    href="#scorecard-specimen"
                    className="px-5 py-3.5 rounded-xl bg-paper border border-stone text-xs sm:text-sm font-sans font-medium text-ink hover:bg-oat transition-colors"
                  >
                    See Sample Scorecard
                  </a>
                  <a
                    href="#topics-catalogue"
                    className="px-4 py-3.5 text-xs sm:text-sm font-sans font-medium text-graphite hover:text-ink editorial-link"
                  >
                    Browse 5 Topics
                  </a>
                </div>

                {/* Key Product Facts */}
                <div className="pt-4 border-t border-stone grid grid-cols-3 gap-4 sm:gap-6">
                  <div>
                    <div className="font-serif text-2xl sm:text-3xl font-bold text-ink">
                      <AnimatedNumber value={3} suffix=" Roles" />
                    </div>
                    <div className="text-xs font-sans text-ashen">
                      Moderator, Supporter, Challenger
                    </div>
                  </div>
                  <div>
                    <div className="font-serif text-2xl sm:text-3xl font-bold text-ink">
                      <AnimatedNumber value={8} suffix=" Rubrics" />
                    </div>
                    <div className="text-xs font-sans text-ashen">
                      Grounded in your exact quotes
                    </div>
                  </div>
                  <div>
                    <div className="font-serif text-2xl sm:text-3xl font-bold text-clay">
                      <AnimatedNumber value={3} suffix="–5 Min" />
                    </div>
                    <div className="text-xs font-sans text-ashen">
                      Focused daily practice rounds
                    </div>
                  </div>
                </div>
              </div>

              {/* Right 5 Columns: Illustrative thinking orb */}
              <div className="lg:col-span-5 min-w-0 w-full">
                <WordGlobeHero />
              </div>
            </div>
          </div>
        </section>

        {/* How It Works: Three Panel Postures & FAQ */}
        <ArchitectureTrustFolio />

        {/* Discussion Topics & Pressure Calibration */}
        <section
          id="topics-catalogue"
          aria-labelledby="topics-heading"
          className="py-14 sm:py-20 lg:py-24 border-b border-stone bg-paper"
        >
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
            <ScrollReveal className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-10 items-end">
              <div className="lg:col-span-7">
                <div className="text-xs font-mono uppercase tracking-wider text-clay font-semibold mb-2 flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-clay" />
                  <span>CURATED SPEAKING &amp; DEFENSE PROMPTS</span>
                </div>
                <h2
                  id="topics-heading"
                  className="font-serif text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-ink leading-[1.1] text-balance"
                >
                  Five high-stakes prompts for GDs, vivas, debates &amp;
                  interviews.
                </h2>
              </div>
              <div className="lg:col-span-5">
                <p className="font-sans text-sm sm:text-base text-graphite leading-relaxed">
                  Select any prompt below to enter the voice practice studio.
                  Each motion is calibrated with adaptive follow-up questions
                  and counterarguments to test how clearly you defend a position
                  under time pressure.
                </p>
              </div>
            </ScrollReveal>

            <LivePanelSimulator />
          </div>
        </section>

        {/* Interactive Sample Scorecard */}
        <ScorecardInspector />
      </main>

      {/* Footer */}
      <footer className="bg-inversion text-paper border-t border-ink py-14 sm:py-16">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 pb-12 border-b border-paper/15 items-center">
            <div className="lg:col-span-7">
              <div className="text-xs font-mono uppercase tracking-wider text-clay mb-2">
                PRACTICE MAKES COMPOSURE
              </div>
              <h2 className="font-serif text-2xl sm:text-4xl font-semibold text-paper tracking-tight leading-tight text-balance">
                Walk into your next group discussion knowing how you sound under
                pressure.
              </h2>
              <p className="font-sans text-sm sm:text-base text-cloud mt-3 max-w-xl leading-relaxed">
                Start a 3-minute voice session, test your opening claim against
                live pushback, and review your 8-dimension scorecard
                immediately.
              </p>
            </div>
            <div className="lg:col-span-5 flex flex-wrap lg:justify-end gap-3">
              <Link
                href="/practice"
                className="btn-clay-tab px-6 py-3.5 text-sm font-sans font-semibold"
              >
                Start Practicing Now →
              </Link>
              <Link
                href="/practice?view=history"
                className="px-5 py-3.5 rounded-xl border border-paper/25 text-xs sm:text-sm font-sans text-paper hover:bg-paper/10 transition-colors"
              >
                View Past Sessions
              </Link>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs font-mono text-cloud">
            <div className="flex items-center gap-2.5">
              <span className="inline-block w-2 h-2 rounded-full bg-clay" />
              <span className="text-paper font-semibold">SAMVAAD</span>
              <span>· AI Group Discussion &amp; Placement Coach</span>
            </div>
            <div className="flex flex-wrap gap-6">
              <Link
                href="/practice"
                className="hover:text-paper transition-colors"
              >
                Practice Studio
              </Link>
              <Link
                href="/practice?view=history"
                className="hover:text-paper transition-colors"
              >
                Session History
              </Link>
              <a
                href="#scorecard-specimen"
                className="hover:text-paper transition-colors"
              >
                Rubric
              </a>
              <a href="#faq" className="hover:text-paper transition-colors">
                FAQ
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
