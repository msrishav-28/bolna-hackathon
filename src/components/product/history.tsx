"use client";
import { useState } from "react";
import { ApiError } from "@/lib/client/api";
import { productRequest } from "@/lib/client/product-api";
import { useProductResource } from "@/lib/client/use-product-resource";
import {
  historySchema,
  type HistoryData,
  type SessionSummary,
} from "@/lib/product-contracts";
import {
  PageHeading,
  BusyState,
  ErrorPanel,
  EmptyHistory,
  SessionRows,
} from "./shared";

export function History({ sample }: { sample?: HistoryData }) {
  const [filter, setFilter] = useState("");
  const [extra, setExtra] = useState<SessionSummary[]>([]);
  const [cursor, setCursor] = useState<string | null | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const path = `/api/sessions?limit=20${filter ? `&status=${filter}` : ""}`;
  const resource = useProductResource(sample ? null : path, historySchema);
  const data = sample ?? resource.data;
  const sessions = data
    ? [...data.sessions, ...extra].filter(
        (session) => !filter || session.status === filter,
      )
    : [];
  const next = cursor === undefined ? data?.nextCursor : cursor;
  async function more() {
    if (!next || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await productRequest(
        `${path}&cursor=${encodeURIComponent(next)}`,
        historySchema,
      );
      setExtra((old) => [
        ...old,
        ...result.sessions.filter(
          (item) =>
            ![...(data?.sessions ?? []), ...old].some((s) => s.id === item.id),
        ),
      ]);
      setCursor(result.nextCursor);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "We couldn’t load more rounds. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  const trend = data?.stats.comparison?.trend ?? [];
  return (
    <main id="main" tabIndex={-1} className="product-main">
      <PageHeading eyebrow="Your history" title="Past sessions & progress.">
        Review your feedback and take one useful change into your next attempt.
      </PageHeading>
      {data && (
        <section className="history-overview">
          <div>
            <p className="eyebrow">Completed rounds</p>
            <strong className="history-total">{data.stats.completed}</strong>
            <p>
              {data.stats.completed < 2
                ? "A little repetition goes a long way."
                : `Average readiness: ${data.stats.averageScore === null ? "—" : Math.round(data.stats.averageScore)}/100`}
            </p>
          </div>
          <div className="trend-panel">
            <h2>Comparable practice over time</h2>
            {trend.length >= 2 ? (
              <figure>
                <svg
                  viewBox="0 0 600 150"
                  role="img"
                  aria-label="Readiness scores across your recent completed rounds. Exact values are listed below."
                >
                  <path
                    d="M20 25H580M20 75H580M20 125H580"
                    stroke="currentColor"
                    strokeDasharray="2 6"
                    opacity=".25"
                  />
                  <polyline
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    points={trend
                      .map(
                        (point, index) =>
                          `${20 + (index * 560) / (trend.length - 1)},${125 - point.score}`,
                      )
                      .join(" ")}
                  />
                  {trend.map((point, index) => (
                    <circle
                      key={point.id}
                      cx={20 + (index * 560) / (trend.length - 1)}
                      cy={125 - point.score}
                      r="5"
                      fill="var(--accent-clay)"
                      stroke="var(--ink-slate)"
                    />
                  ))}
                </svg>
                <figcaption>
                  <p className="text-xs">
                    Same mode, topic, rubric, pressure and duration ·
                    chronological attempts · scores 0–100
                  </p>
                  <details>
                    <summary>Read exact scores</summary>
                    <ol>
                      {trend.map((point) => (
                        <li key={point.id}>
                          {new Date(point.completedAt).toLocaleDateString(
                            "en-GB",
                            { timeZone: "UTC" },
                          )}
                          : {point.score}/100
                        </li>
                      ))}
                    </ol>
                  </details>
                </figcaption>
              </figure>
            ) : (
              <p className="trend-empty">
                Comparable progress is not available yet. Open a scorecard to
                review its evidence and practise the same topic again.
              </p>
            )}
          </div>
        </section>
      )}
      <section>
        <div className="product-section-head">
          <h2>Every round, in one place.</h2>
          <label className="history-filter">
            Show
            <select
              value={filter}
              disabled={busy}
              onChange={(event) => {
                setFilter(event.target.value);
                setExtra([]);
                setCursor(undefined);
                setError("");
              }}
            >
              <option value="">All rounds</option>
              <option value="completed">Completed</option>
              <option value="processing">Preparing feedback</option>
              <option value="failed">Needs attention</option>
              <option value="expired">Expired</option>
            </select>
          </label>
        </div>
        {!data && resource.loading ? (
          <BusyState label="Loading your history…" />
        ) : !data && resource.error ? (
          <ErrorPanel
            error={resource.error}
            retry={resource.retry}
            back="/history"
          />
        ) : sessions.length ? (
          <SessionRows sessions={sessions} preview={!!sample} />
        ) : filter ? (
          <div className="notice-panel">
            <h2>No rounds in this view.</h2>
            <p>Try another filter or view all your rounds.</p>
            <button
              className="button secondary"
              onClick={() => {
                setFilter("");
                setExtra([]);
                setCursor(undefined);
              }}
            >
              Show all rounds
            </button>
          </div>
        ) : (
          <EmptyHistory preview={!!sample} />
        )}
        {next && (
          <button
            className="button secondary load-more"
            onClick={() => void more()}
            disabled={busy}
          >
            {busy ? "Loading rounds…" : "Load more rounds"}
          </button>
        )}
        {error && (
          <p role="alert" className="form-message">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
