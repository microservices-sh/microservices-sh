import type { IdempotencyStore } from "../ports";
import type { IdempotencyRecord } from "../types";

function mapKey(scope: string, key: string): string {
  return `${scope}\u0000${key}`;
}

function clone(record: IdempotencyRecord): IdempotencyRecord {
  return {
    ...record,
    response: record.response ? { ...record.response } : null,
    error: record.error ? { ...record.error } : null,
    metadata: { ...record.metadata }
  };
}

export function createMemoryIdempotencyStore(): IdempotencyStore {
  const records = new Map<string, IdempotencyRecord>();

  return {
    async insert(record) {
      const key = mapKey(record.scope, record.key);
      if (records.has(key)) {
        throw new Error("UNIQUE constraint failed: idempotency_records.scope, idempotency_records.key");
      }
      records.set(key, clone(record));
    },

    async get(scope, key) {
      const record = records.get(mapKey(scope, key));
      return record ? clone(record) : null;
    },

    async update(record) {
      records.set(mapKey(record.scope, record.key), clone(record));
    },

    async replace(record, previousUpdatedAt) {
      const key = mapKey(record.scope, record.key);
      const existing = records.get(key);
      if (!existing || existing.updatedAt !== previousUpdatedAt) return false;
      records.set(key, clone(record));
      return true;
    },

    async deleteExpired(beforeIso, limit) {
      const expired = [...records.entries()]
        .filter(([, record]) => record.expiresAt <= beforeIso)
        .sort((a, b) => a[1].expiresAt.localeCompare(b[1].expiresAt))
        .slice(0, limit);
      for (const [key] of expired) {
        records.delete(key);
      }
      return expired.length;
    },

    async list(filter) {
      let rows = [...records.values()];
      if (filter.scope) {
        rows = rows.filter((record) => record.scope === filter.scope);
      }
      if (filter.status) {
        rows = rows.filter((record) => record.status === filter.status);
      }
      if (filter.expiredBefore) {
        const expiredBefore = filter.expiredBefore;
        rows = rows.filter((record) => record.expiresAt <= expiredBefore);
      }
      rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return rows.slice(0, filter.limit ?? 100).map(clone);
    }
  };
}
