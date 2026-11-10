"use client";
import Link from "next/link";
import { ApiError } from "@/lib/client/api";
import {
  difficultyLabels,
  sessionHref,
  statusLabels,
  type SessionSummary,
} from "@/lib/product-contracts";

export function productHref(path: string, preview = false) {
  if (!preview) return path;
  const screen = path.startsWith("/report")
    ? "report"
    : path.includes("/processing")
      ? "processing"
      : path.includes("/check")
        ? "check"
        : path.startsWith("/practice/session")
          ? "live"
          : path.startsWith("/practice")
            ? "setup"
            : path.startsWith("/history")
              ? "history"
              : path.startsWith("/account")
                ? "account"
                : "dashboard";
  const query = path.split("?")[1];
  return `/preview?screen=${screen}${query ? `&${query}` : ""}`;
}
export function setupQuery(session: {
  topic: { id: string };
  difficulty: string;
  durationSeconds: number;
  mode?: string;
}) {
  return `topic=${session.topic.id}&difficulty=${session.difficulty}&duration=${session.durationSeconds}&mode=${session.mode ?? "group_discussion"}`;
}
export function PageHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="product-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {children && <p className="product-lead">{children}</p>}
    </div>
  );
}
export function BusyState({
  label = "Loading your practice…",
}: {
  label?: string;
}) {
  return (
    <div className="product-loading" role="status">
      <span className="loading-mark" aria-hidden="true" />
      <p>{label}</p>
      <div className="skeleton-row" aria-hidden="true" />
      <div className="skeleton-row short" aria-hidden="true" />
    </div>
  );
}
export function ErrorPanel({
  error,
  retry,
  back = "/dashboard",
}: {
  error: ApiError;
  retry?: () => void;
  back?: string;
}) {
  const signIn =
    error.code === "UNAUTHENTICATED" || error.code === "VERIFY_EMAIL";
  return (
    <section className="notice-panel" role="alert">
      <span className="tag">
        {signIn
          ? "Your account"
          : error.code === "RATE_LIMITED"
            ? "Daily practice limit"
            : "Let’s get you back"}
      </span>
      <h2>
        {signIn
          ? "Sign in to continue."
          : error.code === "SESSION_NOT_FOUND"
            ? "This session isn’t available."
            : error.code === "RATE_LIMITED"
              ? "Time to put practice into action."
              : "We couldn’t connect."}
      </h2>
      <p>{error.message}</p>
      <div className="action-group">
        {signIn ? (
          <Link
            className="button"
            href={`/auth?next=${encodeURIComponent(back)}`}
          >
            Sign in <span aria-hidden="true">↗</span>
          </Link>
        ) : (
          retry && (
            <button className="button" onClick={retry}>
              Try again
            </button>
          )
        )}
        <Link
          className="text-link"
          href={error.code === "RATE_LIMITED" ? "/history" : back}
        >
          {" "}
          {error.code === "RATE_LIMITED"
            ? "View your history"
            : "Back to practice"}{" "}
          <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </section>
  );
}
export function SessionRows({
  sessions,
  preview = false,
}: {
  sessions: SessionSummary[];
  preview?: boolean;
}) {
  return (
    <ul className="session-list">
      {sessions.map((session) => (
        <li key={session.id}>
          <div className="session-date">
            <span>
              {new Date(session.createdAt).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                timeZone: "UTC",
              })}
            </span>
            <small>
              {session.durationSeconds / 60} min ·{" "}
              {difficultyLabels[session.difficulty]}
            </small>
          </div>
          <Link
            href={productHref(sessionHref(session), preview)}
            className="session-title"
          >
            {session.topic.title}
            <span>{statusLabels[session.status]}</span>
          </Link>
          <div className="session-score">
            {session.status === "completed" && session.overallScore !== null ? (
              <>
                {session.overallScore}
                <small>/100</small>
              </>
            ) : (
              <span className="session-status">
                {statusLabels[session.status]}
              </span>
            )}
          </div>
          <Link
            className="round-link"
            aria-label={`Open session: ${session.topic.title}`}
            href={productHref(sessionHref(session), preview)}
          >
            ↗
          </Link>
        </li>
      ))}
    </ul>
  );
}
export function EmptyHistory({ preview = false }: { preview?: boolean }) {
  return (
    <div className="empty-practice">
      <span className="empty-symbol" aria-hidden="true">
        ↗
      </span>
      <div>
        <h2>Your first round starts here.</h2>
        <p>
          Choose a topic and speak your mind. Your scorecard will appear here
          after the discussion.
        </p>
        <Link className="button" href={productHref("/practice", preview)}>
          Choose a topic <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </div>
  );
}
