import type { RateLimitStore } from "../ports";

// Fixed-window rate limiter backed by KV. Note: KV get/put is not atomic and is
// eventually consistent, so this is approximate under high concurrency — adequate
// for coarse abuse protection. Use a Durable Object for strict per-key limits.
export function createKvRateLimitStore(kv: KVNamespace): RateLimitStore {
  return {
    async hit(identifier, limit, windowSeconds) {
      const nowSec = Math.floor(Date.now() / 1000);
      const bucket = Math.floor(nowSec / windowSeconds);
      const key = "rl:" + identifier + ":" + bucket;
      const current = Number((await kv.get(key)) ?? "0");
      const count = current + 1;
      // KV minimum expirationTtl is 60s.
      await kv.put(key, String(count), { expirationTtl: Math.max(windowSeconds, 60) });
      const resetAt = new Date((bucket + 1) * windowSeconds * 1000).toISOString();
      return { allowed: count <= limit, count, limit, resetAt };
    }
  };
}
