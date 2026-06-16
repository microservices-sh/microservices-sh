import type { BadgeVariant } from "./components/types";

/**
 * Maps a booking status to a Badge variant.
 * default (accent) = active/confirmed · warn = pending · danger = cancelled · muted = done.
 * Edit the buckets below to match your own status vocabulary.
 */
export function statusBadgeVariant(status: string | null | undefined): BadgeVariant {
  switch ((status ?? "").toLowerCase()) {
    case "cancelled":
    case "canceled":
    case "declined":
    case "no_show":
      return "danger";
    case "pending":
    case "tentative":
    case "hold":
    case "awaiting":
      return "warn";
    case "completed":
    case "done":
    case "fulfilled":
      return "muted";
    default:
      return "default";
  }
}
