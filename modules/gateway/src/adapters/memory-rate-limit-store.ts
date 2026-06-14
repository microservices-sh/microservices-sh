import type { RateLimitStore } from "../ports";

export function createMemoryRateLimitStore(now: () => number = () => Date.now()): RateLimitStore {
  const counters = new Map<string, number>();

  return {
    async hit(identifier, limit, windowSeconds) {
      const bucket = Math.floor(Math.floor(now() / 1000) / windowSeconds);
      const key = identifier + ":" + bucket;
      const count = (counters.get(key) ?? 0) + 1;
      counters.set(key, count);
      const resetAt = new Date((bucket + 1) * windowSeconds * 1000).toISOString();
      return { allowed: count <= limit, count, limit, resetAt };
    }
  };
}
