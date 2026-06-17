/**
 * Maps a booking status to a @microservices-sh/ui Badge tone.
 * good = confirmed/completed · warn = pending/tentative · bad = cancelled · neutral = everything else.
 * Edit the buckets below to match your own status vocabulary.
 */
export function statusBadgeVariant(status: string | null | undefined): string {
  switch ((status ?? "").toLowerCase()) {
    case "cancelled":
    case "canceled":
    case "declined":
    case "no_show":
      return "bad";
    case "pending":
    case "tentative":
    case "unconfirmed":
      return "warn";
    case "completed":
    case "done":
    case "confirmed":
      return "good";
    default:
      return "neutral";
  }
}
