import type { IdempotencyListFilter, IdempotencyRecord } from "../types";

export interface IdempotencyStore {
  insert(record: IdempotencyRecord): Promise<void>;
  get(scope: string, key: string): Promise<IdempotencyRecord | null>;
  update(record: IdempotencyRecord): Promise<void>;
  // Compare-and-swap style replacement used to reclaim expired records or stale
  // in-progress locks without overwriting a concurrent completion.
  replace(record: IdempotencyRecord, previousUpdatedAt: string): Promise<boolean>;
  deleteExpired(beforeIso: string, limit: number): Promise<number>;
  list(filter: IdempotencyListFilter): Promise<IdempotencyRecord[]>;
}
