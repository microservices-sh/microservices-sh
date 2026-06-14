// Deterministic exponential backoff (no jitter, so it is testable). attempt is
// 1-based: the delay applied *after* the Nth failed attempt before the next try.
// Customization seam: override via the computeBackoffMs hook.
export function computeBackoffMs(attempt: number, baseMs = 1000, capMs = 300_000): number {
  const safeAttempt = Math.max(1, Math.floor(attempt));
  const raw = baseMs * 2 ** (safeAttempt - 1);
  return Math.min(capMs, raw);
}

// Advance a schedule's nextRunAt past `now` with catch-up semantics: when one or
// more windows were missed, the next fire is the first interval strictly in the
// future — the job runs once now, not once per missed window (no retry storm).
export function nextScheduleTick(currentNextMs: number, intervalMs: number, nowMs: number): number {
  if (intervalMs <= 0) return nowMs + 1;
  let next = currentNextMs;
  if (next <= nowMs) {
    const missed = Math.floor((nowMs - next) / intervalMs) + 1;
    next = next + missed * intervalMs;
  }
  return next;
}
