import type { SigningKeyStore } from "../ports";
import type { DomainEvent, SigningKey } from "../types";

export function createMemorySigningKeyStore(): SigningKeyStore {
  const keys = new Map<string, SigningKey>();
  const events: DomainEvent[] = [];

  return {
    async getActiveKey() {
      const active = [...keys.values()].filter((key) => key.status === "active");
      active.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return active[0] ?? null;
    },

    async getKey(kid) {
      return keys.get(kid) ?? null;
    },

    async listPublicKeys() {
      // Strip the private JWK — public-only material for JWKS.
      return [...keys.values()]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 10)
        .map(({ privateJwk, ...publicKey }) => publicKey);
    },

    async retireActiveKeys(retiredAt) {
      for (const key of keys.values()) {
        if (key.status === "active") {
          key.status = "retired";
          key.retiredAt = retiredAt;
        }
      }
    },

    async putKey(key) {
      keys.set(key.kid, { ...key });
    },

    async writeEvent(event) {
      events.push(event);
    }
  };
}
