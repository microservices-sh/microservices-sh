/**
 * Maps a subscription status to a @microservices-sh/ui Badge tone.
 * good (green) = active · warn = trialing/past_due · bad = canceled/unpaid ·
 * neutral = paused. Edit the buckets below to match your own status vocabulary.
 */
export function statusBadgeVariant(status: string | null | undefined): "good" | "warn" | "bad" | "neutral" {
  switch ((status ?? "").toLowerCase()) {
    case "canceled":
    case "cancelled":
    case "unpaid":
      return "bad";
    case "trialing":
    case "past_due":
      return "warn";
    case "paused":
      return "neutral";
    default:
      return "good";
  }
}
