"use client";
import Link from "next/link";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" tabIndex={-1} className="app-shell narrow">
      <p className="eyebrow">Page unavailable</p>
      <h1>
        Let’s try
        <br />
        that again.
      </h1>
      <p className="lead">
        This page could not load. Try again, or return to the start.
      </p>
      <div className="action-group">
        <button className="button" onClick={reset}>
          Try again
        </button>
        <Link className="text-link" href="/">
          Back to Samvaad
        </Link>
      </div>
    </main>
  );
}
