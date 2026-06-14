/**
 * Maps a subscription status to a pill style class.
 * Accent (default) = active · warn = trialing/past_due · danger = canceled/unpaid · muted = paused.
 * Edit the buckets below to match your own status vocabulary.
 */
export function statusPillClass(status: string | null | undefined): string {
  switch ((status ?? "").toLowerCase()) {
    case "canceled":
    case "cancelled":
    case "unpaid":
      return "pill is-danger";
    case "trialing":
    case "past_due":
      return "pill is-warn";
    case "paused":
      return "pill is-muted";
    default:
      return "pill";
  }
}
