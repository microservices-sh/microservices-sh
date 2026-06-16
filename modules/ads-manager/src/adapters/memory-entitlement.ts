import type { Entitlement } from "../ports";

// Test/dev entitlement. Real hosts implement Entitlement against
// billing-subscriptions (`grantsAccess` on the $1.90/mo ads plan).
export function createMemoryEntitlement(active = true, reason = "no active ads subscription"): Entitlement {
  return {
    async check() {
      return active ? { active: true } : { active: false, reason };
    },
  };
}
