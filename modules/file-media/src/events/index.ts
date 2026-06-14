// Provider module: emits media lifecycle events. The ticket-expiry sweep is
// driven by the host (e.g. a jobs-workflows schedule).
export const events = {
  emitted: ["media.upload_requested", "media.uploaded", "media.deleted", "media.ticket_expired"],
  consumed: []
} as const;
