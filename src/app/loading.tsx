export default function Loading() {
  return (
    <main id="main" tabIndex={-1} className="app-shell">
      <span className="loading-mark" aria-hidden="true" />
      <p role="status">Loading the page…</p>
    </main>
  );
}
