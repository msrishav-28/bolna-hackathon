"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { ApiError } from "@/lib/client/api";
import { productRequest } from "@/lib/client/product-api";
import { useProductResource } from "@/lib/client/use-product-resource";
import {
  sessionResponseSchema,
  type Topic,
  difficultyLabels,
} from "@/lib/product-contracts";
import {
  practiceOptionsSchema,
  createPracticeBody,
  modeSchema,
  modeLabels,
  modeDescriptions,
  type PracticeMode,
} from "@/lib/practice-contracts";
import type { Difficulty } from "@/lib/domain/samvaad";
import { BusyState, ErrorPanel, productHref } from "./shared";

const pressures = {
  gentle: "Room to find your words. A little less pushback.",
  standard: "Follow-up questions and a fair challenge to your point.",
  intense: "Sharper challenges. Keep your reasoning clear under pressure.",
} as const;
const topicTitles: Record<string, string> = {
  "ai-assignments": "Should colleges allow AI tools for assignments?",
  "remote-early-career": "Is remote work better for early career growth?",
  "social-media-age": "Should social media have age verification?",
  "internships-vs-classroom": "Are internships better than classroom learning?",
  "india-ai-skills": "Should India prioritize AI skills in every degree?",
};
export function Setup({
  sample,
  initial = {},
}: {
  sample?: Topic[];
  initial?: {
    topic?: string;
    difficulty?: Difficulty;
    duration?: 180 | 300;
    mode?: string;
    from?: string;
  };
}) {
  const resource = useProductResource(
    sample ? null : "/api/practice-options",
    practiceOptionsSchema,
  );
  const [mode, setMode] = useState<PracticeMode>(
    modeSchema.catch("group_discussion").parse(initial.mode),
  );
  const [selected, setSelected] = useState(initial.topic ?? "");
  const [difficulty, setDifficulty] = useState<Difficulty>(
    initial.difficulty ?? "standard",
  );
  const [duration, setDuration] = useState<180 | 300>(initial.duration ?? 180);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const creation = useRef<{ body: string; key: string } | null>(null);
  const pending = useRef(false);
  const router = useRouter();
  const options = sample
    ? {
        contractVersion: 1 as const,
        quota: null,
        modes: modeSchema.options.map((id) => ({
          id,
          label: modeLabels[id],
          description: modeDescriptions[id],
          available: id === "group_discussion",
          unavailableReason:
            id === "group_discussion"
              ? null
              : "This practice mode is not available yet.",
          topics: id === "group_discussion" ? sample : [],
          durations: [180, 300] as (180 | 300)[],
          rubricVersion: "gd-legacy-v1",
        })),
      }
    : resource.data;
  const active = options?.modes.find((item) => item.id === mode);
  const topics = active?.topics;
  const topic = topics?.find(
    (item) => item.id === selected || item.title === topicTitles[selected],
  );
  const supportedDuration = !!active?.durations.includes(duration);
  const previous = useProductResource(
    !sample && z.uuid().safeParse(initial.from).success
      ? `/api/sessions/${initial.from}`
      : null,
    sessionResponseSchema,
  );
  const prior = previous.data?.session;
  const previousActions =
    prior?.status === "completed" &&
    prior.topic.id === topic?.id &&
    (prior.mode ?? "group_discussion") === mode
      ? prior.scorecard?.practiceActions
      : null;
  const destination = `/practice?mode=${mode}&topic=${encodeURIComponent(selected)}&difficulty=${difficulty}&duration=${duration}`;
  async function create() {
    if (
      !topic ||
      !active?.available ||
      !supportedDuration ||
      pending.current ||
      options?.quota?.remaining === 0
    )
      return;
    if (sample) {
      router.push(
        productHref(
          `/practice/session/preview/check?topic=${topic.id}&difficulty=${difficulty}&duration=${duration}`,
          true,
        ),
      );
      return;
    }
    pending.current = true;
    setBusy(true);
    setError(null);
    const body = createPracticeBody(
      options!.contractVersion,
      mode,
      topic.id,
      difficulty,
      duration,
    );
    const serialized = JSON.stringify(body);
    if (creation.current?.body !== serialized)
      creation.current = { body: serialized, key: crypto.randomUUID() };
    try {
      const result = await productRequest(
        "/api/sessions",
        sessionResponseSchema,
        { body, key: creation.current.key },
      );
      router.push(`/practice/session/${result.session.id}/check`);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause
          : new ApiError("We couldn’t start this round. Try again.", "NETWORK"),
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <main id="main" tabIndex={-1} className="product-main">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-8 border-b border-stone">
        <div>
          <p className="eyebrow">New practice session · English</p>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight">
            Choose your speaking prompt and panel pressure.
          </h1>
        </div>
        <p className="text-sm text-graphite max-w-md">
          Pick a prompt, calibrate the challenge, and enter the voice room.
        </p>
      </div>
      {!options ? (
        resource.error ? (
          <ErrorPanel
            error={resource.error}
            retry={resource.retry}
            back={destination}
          />
        ) : (
          <BusyState label="Finding your topics…" />
        )
      ) : (
        <>
          <fieldset className="my-6" disabled={busy}>
            <legend className="eyebrow mb-3">Practice mode</legend>
            <div className="flex flex-wrap gap-2">
              {options.modes.map((item) => (
                <label
                  key={item.id}
                  className={`mode-choice ${mode === item.id ? "selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="mode"
                    value={item.id}
                    checked={mode === item.id}
                    onChange={() => {
                      setMode(item.id);
                      setSelected("");
                      setError(null);
                    }}
                  />
                  <span>
                    {item.label}
                    {!item.available && (
                      <small className="block text-[10px]">
                        Not available yet
                      </small>
                    )}
                  </span>
                </label>
              ))}
            </div>
            <p className="text-sm text-graphite mt-3">{active?.description}</p>
          </fieldset>
          {initial.mode && !modeSchema.safeParse(initial.mode).success && (
            <p role="status" className="notice-panel">
              That practice mode is not recognised. Choose a mode below.
            </p>
          )}
          {!active?.available && (
            <p role="status" className="notice-panel">
              {active?.unavailableReason}
            </p>
          )}
          {previousActions && (
            <aside className="bg-manilla rounded-2xl border border-stone p-5 mb-6">
              <p className="eyebrow">Your previous practice actions</p>
              <ol className="list-decimal pl-5">
                {previousActions.map((action) => (
                  <li key={action.title}>
                    <strong>{action.title}</strong> — {action.detail}
                  </li>
                ))}
              </ol>
            </aside>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void create();
            }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
          >
            <fieldset
              disabled={busy}
              className="lg:col-span-7 min-w-0 flex flex-col gap-3.5"
            >
              <legend className="eyebrow mb-4">
                1. Pick a topic · {topics?.length ?? 0} prompts
              </legend>
              {selected && !topic && (
                <p role="status" className="text-sm">
                  That topic is unavailable for this mode. Select a prompt to
                  continue.
                </p>
              )}
              {topics?.map((item, index) => (
                <label
                  key={item.id}
                  className={`topic-choice ${topic?.id === item.id ? "selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="topic"
                    value={item.id}
                    checked={topic?.id === item.id}
                    onChange={() => setSelected(item.id)}
                  />
                  <div>
                    <span className="text-xs font-mono uppercase text-ashen">
                      Topic {index + 1} · {item.category}
                    </span>
                    <h2 className="font-serif text-lg sm:text-xl font-semibold my-1.5">
                      {item.title}
                    </h2>
                    <p className="text-sm text-graphite">{item.description}</p>
                  </div>
                  <span className="text-xs font-mono self-start">
                    {topic?.id === item.id ? "Selected" : ""}
                  </span>
                </label>
              ))}
              {!topics?.length && (
                <p className="rounded-2xl border border-stone p-6 text-graphite">
                  Prompts will appear here when this mode becomes available.
                </p>
              )}
            </fieldset>
            <aside className="lg:col-span-5 min-w-0 rounded-3xl bg-paper border border-stone p-6 sm:p-7 flex flex-col gap-6 lg:sticky lg:top-22">
              <fieldset disabled={busy}>
                <legend className="eyebrow mb-3">2. Panel pressure</legend>
                <div className="grid grid-cols-3 gap-2">
                  {Object.keys(pressures).map((value) => (
                    <label
                      key={value}
                      className={`pressure-choice ${difficulty === value ? "selected" : ""}`}
                    >
                      <input
                        type="radio"
                        name="difficulty"
                        value={value}
                        checked={difficulty === value}
                        onChange={() => setDifficulty(value as Difficulty)}
                      />
                      <span>{difficultyLabels[value as Difficulty]}</span>
                    </label>
                  ))}
                </div>
                <p className="mt-3 p-3 rounded-xl bg-canvas border border-stone text-xs text-graphite">
                  {pressures[difficulty]}
                </p>
              </fieldset>
              <fieldset disabled={busy} className="pt-4 border-t border-stone">
                <legend className="eyebrow mb-3">3. Session duration</legend>
                <div className="grid grid-cols-2 gap-3">
                  {([180, 300] as const).map((value) => (
                    <label
                      key={value}
                      className={`duration-choice ${duration === value ? "selected" : ""}`}
                    >
                      <input
                        type="radio"
                        name="duration"
                        value={value}
                        disabled={!active?.durations.includes(value)}
                        checked={duration === value}
                        onChange={() => setDuration(value)}
                      />
                      <span className="font-serif font-bold text-lg">
                        {value / 60} minutes
                      </span>
                    </label>
                  ))}
                </div>
                {!supportedDuration && (
                  <p className="text-sm mt-2">Choose an available duration.</p>
                )}
              </fieldset>
              <div className="rounded-2xl bg-oat/70 border border-stone p-4">
                <p className="eyebrow">Selected brief</p>
                <p className="font-serif font-semibold my-2">
                  {topic?.title ?? "Select a topic to shape your round."}
                </p>
                <p className="text-xs font-mono">
                  {difficultyLabels[difficulty]} · {duration / 60} minutes · 8
                  dimensions
                </p>
              </div>
              {options.quota && (
                <p className="text-sm">
                  {options.quota.remaining} of {options.quota.limit} sessions
                  remaining. Resets{" "}
                  {new Date(options.quota.resetsAt).toLocaleString()}.
                </p>
              )}
              <button
                className="btn-clay-tab px-5 py-3.5 font-semibold"
                disabled={
                  !topic ||
                  !active?.available ||
                  !supportedDuration ||
                  busy ||
                  options.quota?.remaining === 0
                }
              >
                {busy ? "Preparing your round…" : "Check your microphone"} →
              </button>
              <p className="text-xs text-graphite">
                You’ll check your microphone before the conversation starts.
              </p>
              {error && (
                <div role="alert" className="form-message">
                  <p>{error.message}</p>
                  {["UNAUTHENTICATED", "VERIFY_EMAIL"].includes(error.code) && (
                    <a
                      className="text-link"
                      href={`/auth?next=${encodeURIComponent(destination)}`}
                    >
                      Sign in to continue
                    </a>
                  )}
                </div>
              )}
            </aside>
          </form>
        </>
      )}
    </main>
  );
}
