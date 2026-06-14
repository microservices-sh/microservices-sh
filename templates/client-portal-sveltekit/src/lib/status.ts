/**
 * Maps an invoice / file status to a pill style class.
 * accent (default) = open/active · warn = draft/pending · danger = void/deleted ·
 * muted = paid/archived. Edit the buckets to match your own vocabulary.
 */
export function statusPillClass(status: string | null | undefined): string {
  switch ((status ?? "").toLowerCase()) {
    case "void":
    case "voided":
    case "deleted":
    case "cancelled":
    case "canceled":
      return "pill is-danger";
    case "draft":
    case "pending":
    case "awaiting":
      return "pill is-warn";
    case "paid":
    case "completed":
    case "archived":
      return "pill is-muted";
    default:
      return "pill";
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
