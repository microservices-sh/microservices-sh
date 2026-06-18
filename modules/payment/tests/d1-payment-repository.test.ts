import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { beforeEach, describe, expect, it } from "vitest";
import { createD1PaymentRepository } from "../src/adapters/d1-payment-repository";
import { handleWebhook, signWebhook } from "../src/index";
import type { Payment } from "../src/types";

const SCHEMA = readFileSync(new URL("../migrations/0001_payment.sql", import.meta.url), "utf8");
const T0 = "2026-01-01T00:00:00.000Z";
const SECRET = "whsec_d1_payment_test";

function loadDatabaseSync(): any | null {
  try {
    const require = createRequire(import.meta.url);
    return require("node:sqlite").DatabaseSync;
  } catch {
    return null;
  }
}

function wrapAsD1(db: any) {
  const makeStmt = (sql: string, params: unknown[]) => ({
    bind(...p: unknown[]) {
      return makeStmt(sql, p);
    },
    async first(col?: string) {
      const row = db.prepare(sql).get(...params);
      if (row == null) return null;
      return col == null ? row : (row[col] ?? null);
    },
    async all() {
      return { results: db.prepare(sql).all(...params), success: true, meta: {} };
    },
    async run() {
      const info = db.prepare(sql).run(...params);
      return { success: true, meta: { changes: info.changes, last_row_id: Number(info.lastInsertRowid) } };
    }
  });

  return {
    prepare(sql: string) {
      return makeStmt(sql, []);
    }
  };
}

const DatabaseSync = loadDatabaseSync();

describe.skipIf(!DatabaseSync)("D1PaymentRepository", () => {
  let raw: any;
  let repo: ReturnType<typeof createD1PaymentRepository>;

  beforeEach(() => {
    raw = new DatabaseSync(":memory:");
    raw.exec(SCHEMA);
    repo = createD1PaymentRepository(wrapAsD1(raw) as any);
  });

  function payment(overrides: Partial<Payment> = {}): Payment {
    return {
      id: "pay_1",
      intentId: "pi_1",
      customerId: "cus_1",
      amount: 1_000,
      currency: "usd",
      status: "pending",
      description: null,
      createdAt: T0,
      updatedAt: T0,
      ...overrides
    };
  }

  it("enforces unique intent ids", async () => {
    await repo.insert(payment());
    await expect(repo.insert(payment({ id: "pay_2" }))).rejects.toThrow(/unique|constraint/i);
  });

  it("records webhook event ids atomically", async () => {
    await expect(repo.recordWebhookEventKey("evt_1", T0)).resolves.toBe(true);
    await expect(repo.recordWebhookEventKey("evt_1", T0)).resolves.toBe(false);
  });

  it("dedupes replayed signed webhooks against D1 storage", async () => {
    await repo.insert(payment());
    const body = JSON.stringify({ id: "evt_d1_payment_1", type: "payment_intent.succeeded", data: { object: { id: "pi_1" } } });
    const signature = await signWebhook(body, SECRET, Math.floor(Date.parse(T0) / 1000));

    const first = await handleWebhook(body, signature, {
      paymentRepository: repo,
      webhookSecret: SECRET,
      now: () => Date.parse(T0)
    });
    expect(first).toMatchObject({ ok: true, data: { payment: { status: "succeeded" } } });

    const replay = await handleWebhook(body, signature, {
      paymentRepository: repo,
      webhookSecret: SECRET,
      now: () => Date.parse(T0) + 1_000
    });
    expect(replay).toMatchObject({ ok: true, data: { deduped: true, eventId: "evt_d1_payment_1" } });
    expect(raw.prepare("SELECT COUNT(*) AS count FROM payment_webhook_events").get().count).toBe(1);
  });
});
