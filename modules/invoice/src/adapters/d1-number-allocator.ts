import type { NumberAllocator } from "../ports";

// Atomic, gapless allocation. The upsert increments (or seeds) the series counter
// and RETURNs the new value in a single statement — SQLite serializes writes, so
// two concurrent issues can never receive the same number. This is the correct
// replacement for the read-then-write MAX(number)+1 pattern.
export function createD1NumberAllocator(db: D1Database): NumberAllocator {
  return {
    async allocate(series) {
      const row = await db
        .prepare(
          `INSERT INTO invoice_sequences (series, value) VALUES (?, 1)
           ON CONFLICT(series) DO UPDATE SET value = value + 1
           RETURNING value`
        )
        .bind(series)
        .first<{ value: number }>();
      if (!row) throw new Error(`Failed to allocate number for series ${series}`);
      return Number(row.value);
    }
  };
}
