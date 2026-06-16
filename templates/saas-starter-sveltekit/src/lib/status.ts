import type { BadgeVariant } from "./components/types";

/**
 * Maps a subscription status to a Badge variant.
 * default (accent) = active · warn = trialing/past_due · danger = canceled/unpaid · muted = paused.
 * Edit the buckets below to match your own status vocabulary.
 */
export function statusBadgeVariant(status: string | null | undefined): BadgeVariant {
  switch ((status ?? "").toLowerCase()) {
    case "canceled":
    case "cancelled":
    case "unpaid":
      return "danger";
    case "trialing":
    case "past_due":
      return "warn";
    case "paused":
      return "muted";
    default:
      return "default";
  }
}
