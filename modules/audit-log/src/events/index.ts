// Pure sink: emits its own lifecycle events; consumes any domain event via the
// consume use case (universal — not enumerated here).
export const events = {
  emitted: ["audit.recorded", "audit.exported"],
  consumed: []
} as const;
