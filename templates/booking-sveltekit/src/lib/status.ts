/**
 * Maps a booking status to a pill style class.
 * Accent (default) = active/confirmed · warn = pending · danger = cancelled · muted = done.
 * Edit the buckets below to match your own status vocabulary.
 */
export function statusPillClass(status: string | null | undefined): string {
  switch ((status ?? "").toLowerCase()) {
    case "cancelled":
    case "canceled":
    case "declined":
    case "no_show":
      return "pill is-danger";
    case "pending":
    case "tentative":
    case "hold":
    case "awaiting":
      return "pill is-warn";
    case "completed":
    case "done":
    case "fulfilled":
      return "pill is-muted";
    default:
      return "pill";
  }
}
