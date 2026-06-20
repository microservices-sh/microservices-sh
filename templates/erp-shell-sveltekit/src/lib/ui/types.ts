// Shared presentational types for the operator-console UI primitives.
// These describe data shapes only — the page server loads compute them, the
// components render them. No domain logic lives here.

export type Tone = "neutral" | "good" | "warn" | "bad" | "info";

export interface Metric {
	label: string;
	value: string | number;
	href?: string;
	tone?: Tone;
	/** Small qualifier under the value, e.g. "3 overdue". */
	hint?: string;
}

export interface TimelineEvent {
	title: string;
	detail?: string;
	/** Pre-formatted, e.g. "2 hrs ago" — components stay presentational. */
	time?: string;
	tone?: Tone;
}

export interface SummaryRow {
	label: string;
	value: string;
	href?: string;
}

export interface RailAction {
	label: string;
	href?: string;
	description?: string;
	primary?: boolean;
}
