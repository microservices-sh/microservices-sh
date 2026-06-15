// Provider module: emits image lifecycle events; consumes none.
export const events = {
  emitted: ["image.generated", "image.edited", "image.deleted"],
  consumed: [],
} as const;
