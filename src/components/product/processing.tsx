"use client";
import Link from "next/link";
import { useState } from "react";
import { ApiError } from "@/lib/client/api";
import { productRequest } from "@/lib/client/product-api";
import {
  sessionResponseSchema,
  type ProductSession,
} from "@/lib/product-contracts";
import { PageHeading, productHref } from "./shared";

export function Processing({
  session,
  preview = false,
  retry,
}: {
  session: ProductSession;
  preview?: boolean;
  retry?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const failed = session.status === "failed" || session.status === "expired";
  const complete = session.status === "completed";
  const active = ["created", "awaiting_voice", "in_progress"].includes(
    session.status,
  );
  async function reconcile() {
    if (preview || busy) return;
    setBusy(true);
    setError("");
    try {
      await productRequest(
        `/api/sessions/${session.id}/complete`,
        sessionResponseSchema,
        { body: {} },
      );
      retry?.();
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === "SESSION_NOT_READY")
        retry?.();
      else
        setError(
          cause instanceof ApiError
            ? cause.message
            : "We couldn’t check this round. Try again.",
        );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main" tabIndex={-1} className="product-main processing-main">
      <PageHeading
        eyebrow={failed ? "Your round needs attention" : "After the discussion"}
        title={
          complete
            ? "Your words. A way forward."
            : session.status === "expired"
              ? "This round has timed out."
              : failed
                ? "Let’s get you back on track."
                : active
                  ? "Checking your round."
                  : "Turning words into a next step."
        }
      >
        {complete
          ? "Your scorecard is ready. Take a moment to see what landed."
          : failed
            ? "A missing result is not a score. Your available transcript is kept so the round can be checked."
            : "You can leave this page. Return through your history to check the latest result."}
      </PageHeading>
      <section className="processing-panel">
        <span className="processing-symbol" aria-hidden="true">
          ↗
        </span>
        <h2>{session.topic.title}</h2>
        <ol className="processing-steps">
          <li>
            <span aria-hidden="true">{!active ? "✓" : "1"}</span>
            <div>
              <strong>Session closed</strong>
              <p>
                {active
                  ? "Waiting for the session to close."
                  : "The session is no longer live."}
              </p>
            </div>
          </li>
          <li>
            <span aria-hidden="true">{session.transcript ? "✓" : "2"}</span>
            <div>
              <strong>Transcript received</strong>
              <p>
                {session.transcript
                  ? "Your conversation is available."
                  : "Waiting for the completed conversation."}
              </p>
            </div>
          </li>
          <li>
            <span aria-hidden="true">{complete ? "✓" : "3"}</span>
            <div>
              <strong>Feedback prepared</strong>
              <p>
                {complete
                  ? "Eight dimensions and three practice actions."
                  : "Scores appear only after the transcript has been checked."}
              </p>
            </div>
          </li>
        </ol>
        <p role="status" className="processing-status">
          {session.error?.message ??
            (complete
              ? "Your scorecard is ready."
              : failed
                ? "This round could not be completed."
                : "We’ll check for updates automatically.")}
        </p>
        <div className="action-group">
          {complete ? (
            <Link
              className="button"
              href={productHref(`/report/${session.id}`, preview)}
            >
              Read your scorecard ↗
            </Link>
          ) : session.error?.retryable || active ? (
            <button
              className="button"
              disabled={busy || preview}
              onClick={() => void reconcile()}
            >
              {busy ? "Checking…" : "Check this round again"}
            </button>
          ) : failed ? (
            <Link className="button" href={productHref("/practice", preview)}>
              Start a new round ↗
            </Link>
          ) : (
            <button
              className="button secondary"
              onClick={retry}
              disabled={preview}
            >
              Check for updates
            </button>
          )}
          <Link className="text-link" href={productHref("/history", preview)}>
            Go to history ↗
          </Link>
        </div>
        {failed && session.transcript && (
          <details className="transcript-disclosure">
            <summary>Read your available transcript</summary>
            <pre className="transcript-text">{session.transcript.raw}</pre>
          </details>
        )}
        {error && (
          <p className="form-message" role="alert">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
