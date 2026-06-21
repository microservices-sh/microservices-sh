import type { RecurringInvoiceFrequency } from "../types";

export function nextRecurringInvoiceDate(
  currentIso: string,
  frequency: RecurringInvoiceFrequency,
  customDays?: number | null
): string {
  const next = new Date(currentIso);
  if (frequency === "weekly") next.setUTCDate(next.getUTCDate() + 7);
  if (frequency === "monthly") next.setUTCMonth(next.getUTCMonth() + 1);
  if (frequency === "quarterly") next.setUTCMonth(next.getUTCMonth() + 3);
  if (frequency === "yearly") next.setUTCFullYear(next.getUTCFullYear() + 1);
  if (frequency === "custom") next.setUTCDate(next.getUTCDate() + (customDays ?? 30));
  return next.toISOString();
}
