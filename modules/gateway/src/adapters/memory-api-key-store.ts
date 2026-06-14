import type { ApiKeyStore } from "../ports";
import type { ApiKeyRecord, DomainEvent } from "../types";

export function createMemoryApiKeyStore(): ApiKeyStore {
  const byHash = new Map<string, ApiKeyRecord>();
  const events: DomainEvent[] = [];

  return {
    async getByHash(hash) {
      return byHash.get(hash) ?? null;
    },
    async putApiKey(record) {
      byHash.set(record.hash, { ...record });
    },
    async revokeApiKey(id) {
      for (const record of byHash.values()) {
        if (record.id === id) record.status = "revoked";
      }
    },
    async writeEvent(event) {
      events.push(event);
    }
  };
}
