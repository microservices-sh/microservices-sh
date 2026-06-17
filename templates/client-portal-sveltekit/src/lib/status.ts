/**
 * Maps an invoice / file status to a kit Badge tone.
 * bad = overdue/void/cancelled/failed · warn = pending/sent/draft/processing ·
 * good = paid/complete · neutral = everything else. Edit the buckets to match
 * your own vocabulary.
 */
export function statusBadgeVariant(status: string | null | undefined): string {
  switch ((status ?? "").toLowerCase()) {
    case "overdue":
    case "void":
    case "voided":
    case "cancelled":
    case "canceled":
    case "failed":
      return "bad";
    case "pending":
    case "sent":
    case "draft":
    case "processing":
      return "warn";
    case "paid":
    case "complete":
    case "completed":
      return "good";
    default:
      return "neutral";
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
