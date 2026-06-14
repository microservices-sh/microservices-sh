import type { NumberAllocator } from "../ports";

export function createMemoryNumberAllocator(): NumberAllocator {
  const counters = new Map<string, number>();
  return {
    async allocate(series) {
      const next = (counters.get(series) ?? 0) + 1;
      counters.set(series, next);
      return next;
    }
  };
}
