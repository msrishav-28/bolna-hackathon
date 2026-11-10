import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" tabIndex={-1} className="app-shell narrow">
      <p className="eyebrow">404 · Page not found</p>
      <h1>
        A wrong turn.
        <br />
        An easy way back.
      </h1>
      <p className="lead">
        The page may have moved, or the link may be incomplete.
      </p>
      <Link className="button" href="/">
        Back to Samvaad <span aria-hidden="true">→</span>
      </Link>
    </main>
  );
}
