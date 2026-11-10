"use client";
import Link from "next/link";
import { useState } from "react";
import {
  SCORE_DIMENSIONS,
  DIMENSION_GUIDE,
  type ScoreDimension,
} from "@/lib/domain/samvaad";
import { difficultyLabels, type ProductSession } from "@/lib/product-contracts";
import { productHref } from "./shared";

export function Scorecard({
  session,
  preview = false,
}: {
  session: ProductSession;
  preview?: boolean;
}) {
  const [selected, setSelected] = useState<ScoreDimension>("clarity");
  const result = session.scorecard;
  if (!result || !session.transcript) return null;
  const dimension = result.dimensions.find(
    (item) => item.dimension === selected,
  )!;
  const quote = dimension.evidenceQuote;
  const matches = quote
    ? session.transcript.turns.flatMap((turn, index) =>
        turn.speaker === "user" && turn.text.includes(quote) ? [index] : [],
      )
    : [];
  const referenced = matches.length === 1 ? matches[0] : null;
  const again = `/practice?topic=${session.topic.id}&difficulty=${session.difficulty}&duration=${session.durationSeconds}&mode=${session.mode ?? "group_discussion"}&from=${session.id}`;
  return (
    <main id="main" tabIndex={-1} className="product-main report-main">
      <section className="rounded-3xl bg-manilla border border-stone p-6 sm:p-8 mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-mono uppercase tracking-wide">
            <span className="bg-ink text-paper px-2.5 py-1 rounded mr-2">
              Session completed
            </span>
            {difficultyLabels[session.difficulty]} ·{" "}
            {session.durationSeconds / 60} min · English
          </p>
          <h1 className="font-serif text-2xl sm:text-4xl font-bold">
            {session.topic.title}
          </h1>
          <p className="text-sm text-graphite max-w-2xl">
            Explore the eight dimensions and the evidence behind them. Take your
            three practice actions into another attempt.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link className="button" href={productHref(again, preview)}>
              Practise again →
            </Link>
            <Link
              className="button secondary"
              href={productHref("/history", preview)}
            >
              View history
            </Link>
          </div>
        </div>
        <div className="rounded-2xl bg-paper border border-stone p-5 text-center shrink-0">
          <p className="text-xs font-mono uppercase text-ashen">
            Overall readiness
          </p>
          <p className="font-serif text-5xl font-bold my-2">
            {result.overallScore}
            <span className="text-xl font-normal text-ashen">/100</span>
          </p>
          <p className="text-xs text-graphite">
            Calculated from eight dimensions
          </p>
        </div>
      </section>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 min-w-0 flex flex-col gap-6">
          <section
            aria-label="Eight scored dimensions"
            className="grid grid-cols-1 sm:grid-cols-2 gap-3.5"
          >
            {SCORE_DIMENSIONS.map((name) => {
              const item = result.dimensions.find((d) => d.dimension === name)!;
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={selected === name}
                  aria-controls="dimension-evidence"
                  onClick={() => setSelected(name)}
                  className={`rounded-2xl p-5 border text-left ${selected === name ? "bg-paper border-ink ring-1 ring-ink" : "bg-paper/75 border-stone hover:bg-paper"}`}
                >
                  <span className="flex justify-between gap-2">
                    <span className="font-serif text-base font-semibold capitalize">
                      {name.replaceAll("_", " ")}
                    </span>
                    <span className="rounded-md bg-manilla px-2 py-1 font-mono text-xs whitespace-nowrap">
                      {item.score} / 5
                    </span>
                  </span>
                  <span className="block text-xs text-ashen mt-1">
                    {DIMENSION_GUIDE[name].label}?
                  </span>
                  <span className="flex gap-1 my-3" aria-hidden="true">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span
                        key={n}
                        className={`h-1.5 flex-1 rounded-full ${n <= item.score ? "bg-ink" : "bg-stone/60"}`}
                      />
                    ))}
                  </span>
                  <span className="block text-sm text-graphite leading-snug line-clamp-2">
                    {item.reason}
                  </span>
                </button>
              );
            })}
          </section>
          <section
            id="dimension-evidence"
            className="rounded-3xl bg-paper border border-stone p-6 flex flex-col gap-3"
            aria-live="polite"
          >
            <h2 className="text-xs font-mono uppercase">
              {selected.replaceAll("_", " ")} · {dimension.score}/5
            </h2>
            <p className="font-serif text-lg leading-relaxed">
              {dimension.reason}
            </p>
            {quote ? (
              <blockquote className="bg-manilla/70 border-l-2 border-clay p-4 rounded-r-xl">
                <p className="text-xs font-mono mb-2">
                  Grounded quote
                  {referenced !== null ? ` · Turn ${referenced + 1}` : ""}
                </p>
                <p className="font-serif italic">“{quote}”</p>
              </blockquote>
            ) : (
              <p className="text-xs text-graphite">
                No reliable direct quote for this dimension.
              </p>
            )}
          </section>
          <section
            aria-label="Moments from your discussion"
            className="grid gap-4"
          >
            {[
              {
                label: "Your strongest moment",
                moment: result.strongestMoment,
              },
              { label: "Your next opportunity", moment: result.weakestMoment },
            ].map(({ label, moment }) => (
              <article
                key={label}
                className="rounded-2xl border border-stone bg-paper p-5"
              >
                <p className="eyebrow">{label}</p>
                <h2 className="font-serif text-xl font-semibold my-2">
                  {moment.title}
                </h2>
                <p className="text-sm text-graphite">{moment.reason}</p>
                {moment.quote && (
                  <blockquote className="mt-3 pl-3 border-l-2 border-clay font-serif italic">
                    “{moment.quote}”
                  </blockquote>
                )}
              </article>
            ))}
          </section>
        </div>
        <div className="lg:col-span-5 min-w-0 flex flex-col gap-6">
          <section className="practice-actions rounded-3xl bg-oat border border-stone p-6">
            <h2 className="text-xs font-mono uppercase font-semibold mb-4">
              Three actions for your next run
            </h2>
            <ol className="flex flex-col gap-3">
              {result.practiceActions.map((action, index) => (
                <li
                  key={action.title}
                  className="bg-paper border border-stone rounded-2xl p-4"
                >
                  <p className="eyebrow mb-2">0{index + 1}</p>
                  <h3 className="font-serif font-semibold mb-1">
                    {action.title}
                  </h3>
                  <p className="text-sm text-graphite leading-relaxed">
                    {action.detail}
                  </p>
                </li>
              ))}
            </ol>
          </section>
          <details
            className="transcript-panel rounded-3xl bg-paper border border-stone p-6"
            open
          >
            <summary className="cursor-pointer text-xs font-mono uppercase font-semibold">
              Read your full transcript · {session.transcript.turns.length}{" "}
              turns
            </summary>
            <p className="text-xs text-graphite my-4">
              Verbatim conversation. Scores use transcript evidence, not accent
              or vocal confidence.
            </p>
            <ol className="flex flex-col gap-3">
              {session.transcript.turns.map((turn, index) => (
                <li
                  key={index}
                  className={`rounded-2xl border p-3.5 ${index === referenced ? "bg-manilla border-clay" : "bg-canvas/60 border-stone"}`}
                >
                  <div className="flex justify-between text-xs font-mono mb-2">
                    <span>
                      {turn.speaker === "user"
                        ? "You"
                        : turn.actor === "moderator"
                          ? "AI moderator"
                          : turn.actor === "peer_a"
                            ? "AI peer A"
                            : turn.actor === "peer_b"
                              ? "AI peer B"
                              : "AI coach"}
                    </span>
                    <span>Turn {index + 1}</span>
                  </div>
                  <p className="font-serif text-sm leading-relaxed whitespace-pre-wrap">
                    {turn.text}
                  </p>
                </li>
              ))}
            </ol>
            {!session.transcript.parsed && (
              <pre className="whitespace-pre-wrap break-words font-serif text-sm">
                {session.transcript.raw}
              </pre>
            )}
          </details>
        </div>
      </div>
    </main>
  );
}
