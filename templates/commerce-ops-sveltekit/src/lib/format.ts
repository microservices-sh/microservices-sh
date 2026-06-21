// Presentation helpers shared across operator pages. Pure functions only.

export const money = (cents: number, currency = "USD"): string =>
	new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

/**
 * Human relative time. Past → "3 hrs ago", future → "in 2 days".
 * `now` is injectable so server loads stay deterministic per request.
 */
export function relativeTime(iso: string | null | undefined, now: number = Date.now()): string {
	if (!iso) return "";
	const then = new Date(iso).getTime();
	if (Number.isNaN(then)) return "";
	const diff = now - then;
	const abs = Math.abs(diff);
	const unit = (n: number, label: string) => `${n} ${label}${n === 1 ? "" : "s"}`;

	if (abs < MIN) return "just now";
	let label: string;
	if (abs < HOUR) label = unit(Math.round(abs / MIN), "min");
	else if (abs < DAY) label = unit(Math.round(abs / HOUR), "hr");
	else label = unit(Math.round(abs / DAY), "day");
	return diff >= 0 ? `${label} ago` : `in ${label}`;
}

/** "invoice.payment_recorded" → "Invoice payment recorded". */
export function humanizeEvent(eventName: string): string {
	const spaced = eventName.replace(/[._]/g, " ").trim();
	return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Whole days until/since an ISO date; negative = overdue. */
export function daysUntil(iso: string | null | undefined, now: number = Date.now()): number | null {
	if (!iso) return null;
	const then = new Date(iso).getTime();
	if (Number.isNaN(then)) return null;
	return Math.round((then - now) / DAY);
}
