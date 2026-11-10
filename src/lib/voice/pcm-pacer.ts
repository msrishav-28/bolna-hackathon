/** Maintain PCM cadence across timer jitter; fail rather than upload stale audio. */
export function startPcmPacer(
  send: () => void,
  onFailure: (reason: "PACER_STALLED" | "SEND_FAILED", lagMs: number) => void,
) {
  const intervalMs = 32;
  const maxLagMs = 512;
  let next = performance.now() + intervalMs;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;
  const stop = () => {
    stopped = true;
    clearTimeout(timer);
  };
  const tick = () => {
    if (stopped) return;
    if (performance.now() - next > maxLagMs) {
      stop();
      onFailure("PACER_STALLED", Math.round(performance.now() - next));
      return;
    }
    try {
      send();
    } catch {
      stop();
      onFailure("SEND_FAILED", Math.round(performance.now() - next));
      return;
    }
    if (stopped) return;
    next += intervalMs;
    timer = setTimeout(tick, Math.max(0, next - performance.now()));
  };
  timer = setTimeout(tick, intervalMs);
  return stop;
}
