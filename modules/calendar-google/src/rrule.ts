import type { ExpandedInstance } from "./types";

// PURE, deterministic RRULE expansion. No I/O, no Date.now(), no timezone DB —
// timestamps are treated as instants (parsed/emitted as UTC epoch ms) so the
// output is reproducible. This is the function agents most often get wrong: they
// reach for a heavy ical library, hand-roll an off-by-one loop, or forget the
// COUNT/UNTIL/window bounds and emit unbounded or duplicated instances.
//
// Supported subset (intentionally small and explicit):
//   FREQ=DAILY | WEEKLY | MONTHLY   (required)
//   INTERVAL=<n>                    (default 1)
//   COUNT=<n>     -- cap total instances
//   UNTIL=<RFC3339 or YYYYMMDD...>  -- inclusive end bound
// One RRULE per series is supported (Google usually emits one). Extra parts
// (BYDAY, BYMONTHDAY, etc.) are ignored rather than guessed — better to under-
// expand deterministically than to invent wrong instances.

export type Frequency = "DAILY" | "WEEKLY" | "MONTHLY";

export interface ParsedRRule {
  freq: Frequency;
  interval: number;
  count: number | null;
  // Inclusive UTC epoch-ms bound, or null when unbounded by UNTIL.
  untilMs: number | null;
}

// Parse one "RRULE:FREQ=...;INTERVAL=...;..." (or the bare "FREQ=..." form).
// Returns null when FREQ is missing/unsupported — caller treats the event as
// single-shot rather than expanding garbage.
export function parseRRule(rule: string): ParsedRRule | null {
  const body = rule.replace(/^RRULE:/i, "").trim();
  if (!body) return null;

  const parts = new Map<string, string>();
  for (const segment of body.split(";")) {
    const eq = segment.indexOf("=");
    if (eq <= 0) continue;
    parts.set(segment.slice(0, eq).trim().toUpperCase(), segment.slice(eq + 1).trim());
  }

  const freqRaw = parts.get("FREQ");
  if (freqRaw !== "DAILY" && freqRaw !== "WEEKLY" && freqRaw !== "MONTHLY") return null;

  const intervalRaw = Number(parts.get("INTERVAL") ?? "1");
  const interval = Number.isFinite(intervalRaw) && intervalRaw >= 1 ? Math.floor(intervalRaw) : 1;

  const countRaw = parts.get("COUNT");
  let count: number | null = null;
  if (countRaw !== undefined) {
    const parsed = Number(countRaw);
    count = Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
  }

  const untilRaw = parts.get("UNTIL");
  const untilMs = untilRaw !== undefined ? parseInstantMs(untilRaw) : null;

  return { freq: freqRaw, interval, count, untilMs };
}

// Parse an RFC3339 datetime, a bare YYYY-MM-DD date, or an iCal basic form
// (YYYYMMDD / YYYYMMDDTHHMMSSZ) into UTC epoch ms. Returns null when unparseable.
export function parseInstantMs(value: string): number | null {
  const trimmed = value.trim();

  // iCal basic forms have no separators: 20260615 or 20260615T090000Z.
  const basic = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(trimmed);
  if (basic) {
    const [, y, mo, d, h = "00", mi = "00", s = "00"] = basic;
    return Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  }

  // RFC3339 / ISO 8601, or a bare YYYY-MM-DD (interpreted as UTC midnight).
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
  const ms = Date.parse(dateOnly ? `${trimmed}T00:00:00Z` : trimmed);
  return Number.isNaN(ms) ? null : ms;
}

// Advance a UTC instant by n occurrences of a frequency. MONTHLY clamps the day
// of month (e.g. Jan 31 + 1 month -> Feb 28/29) so we never roll into the wrong
// month — the classic month-arithmetic bug.
export function addInterval(ms: number, freq: Frequency, steps: number): number {
  if (freq === "DAILY") return ms + steps * 86_400_000;
  if (freq === "WEEKLY") return ms + steps * 7 * 86_400_000;

  // MONTHLY.
  const d = new Date(ms);
  const targetMonthIndex = d.getUTCFullYear() * 12 + d.getUTCMonth() + steps;
  const year = Math.floor(targetMonthIndex / 12);
  const month = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(d.getUTCDate(), lastDay);
  return Date.UTC(year, month, day, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());
}

export interface ExpandWindow {
  // Window bounds as UTC epoch ms (inclusive start, exclusive end). Instances are
  // emitted only when their start falls within [windowStartMs, windowEndMs).
  windowStartMs: number;
  windowEndMs: number;
  // Hard cap so a malformed/huge rule can never produce unbounded output.
  maxInstances?: number;
}

// Expand a recurring event into concrete instances whose start lies within the
// window. Deterministic: same inputs always yield the same ordered instances.
//
// - dtstartMs / dtendMs are the first occurrence's start/end (UTC epoch ms); the
//   instance duration is preserved across occurrences.
// - COUNT and UNTIL bound the *series*; the window then filters which of those
//   bounded occurrences are returned. We still stop walking once we pass the
//   window end or the series bounds, so the loop always terminates.
export function expandRecurrence(
  rules: string[],
  dtstartMs: number,
  dtendMs: number,
  window: ExpandWindow
): ExpandedInstance[] {
  const out: ExpandedInstance[] = [];
  const maxInstances = window.maxInstances ?? 1000;
  if (dtendMs < dtstartMs) return out;

  const rule = rules.map(parseRRule).find((r): r is ParsedRRule => r !== null);
  // Non-recurring (or unsupported rule): a single instance, window-filtered.
  if (!rule) {
    if (dtstartMs >= window.windowStartMs && dtstartMs < window.windowEndMs) {
      out.push({ startAt: new Date(dtstartMs).toISOString(), endAt: new Date(dtendMs).toISOString() });
    }
    return out;
  }

  const duration = dtendMs - dtstartMs;
  let index = 0; // 0-based occurrence number
  while (out.length < maxInstances) {
    if (rule.count !== null && index >= rule.count) break;

    const startMs = addInterval(dtstartMs, rule.freq, index * rule.interval);
    if (rule.untilMs !== null && startMs > rule.untilMs) break;
    // Once we are at or past the window end, no later occurrence can qualify.
    if (startMs >= window.windowEndMs) break;

    if (startMs >= window.windowStartMs) {
      out.push({
        startAt: new Date(startMs).toISOString(),
        endAt: new Date(startMs + duration).toISOString()
      });
    }

    index += 1;
    // Safety valve: COUNT-less, UNTIL-less rules are bounded only by the window,
    // which we already break on above; this guards a pathological interval.
    if (index > maxInstances * 4 + 4) break;
  }

  return out;
}
