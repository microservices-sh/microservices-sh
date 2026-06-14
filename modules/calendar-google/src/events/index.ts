// Vertical sync module: emits connection/sync lifecycle and per-event change
// events. Consumes inbound Google push notifications (handled as a hint, not data).
export const events = {
  emitted: [
    "calendar-google.connected",
    "calendar-google.synced",
    "calendar-google.event.upserted",
    "calendar-google.event.deleted",
    "calendar-google.channel.renewed",
    "calendar-google.token.refreshed"
  ],
  consumed: ["calendar-google.push.received"]
} as const;
