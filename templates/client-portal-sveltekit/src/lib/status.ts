import type { BadgeVariant } from "./components/types";

/**
 * Maps an invoice / file status to a Badge variant.
 * default (accent) = open/active · warn = draft/pending · danger = void/deleted ·
 * muted = paid/archived. Edit the buckets to match your own vocabulary.
 */
export function statusBadgeVariant(status: string | null | undefined): BadgeVariant {
  switch ((status ?? "").toLowerCase()) {
    case "void":
    case "voided":
    case "deleted":
    case "cancelled":
    case "canceled":
      return "danger";
    case "draft":
    case "pending":
    case "awaiting":
      return "warn";
    case "paid":
    case "completed":
    case "archived":
      return "muted";
    default:
      return "default";
  }
}

/** Formats integer cents as a currency string (USD-style grouping). */
export function formatMoney(cents: number | null | undefined, currency = "USD"): string {
  const value = (cents ?? 0) / 100;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}
