import { randomId } from "../crypto";
import type { AccountStore, LoginCodeStore, SessionStore } from "../ports";
import type { Account, LoginCodeRecord, SessionRecord } from "../types";

// D1-backed adapters. Same semantics as the memory adapters (modules/identity/src/
// adapters/memory.ts), against the identity migration (accounts / login_codes / sessions).
// Follows @microservices-sh/auth's D1 adapter pattern: prepare().bind().first()/run().

function rowToAccount(row: Record<string, unknown>): Account {
  return {
    id: String(row.id),
    email: String(row.email),
    isAdmin: Number(row.is_admin) === 1,
    createdAt: String(row.created_at),
  };
}

export function createD1AccountStore(db: D1Database): AccountStore {
  return {
    async findByEmail(email) {
      const row = await db.prepare("SELECT * FROM accounts WHERE email = ?").bind(email).first<Record<string, unknown>>();
      return row ? rowToAccount(row) : null;
    },
    async findById(id) {
      const row = await db.prepare("SELECT * FROM accounts WHERE id = ?").bind(id).first<Record<string, unknown>>();
      return row ? rowToAccount(row) : null;
    },
    async create({ email, isAdmin = false }) {
      const existing = await db.prepare("SELECT * FROM accounts WHERE email = ?").bind(email).first<Record<string, unknown>>();
      if (existing) return rowToAccount(existing);
      const account: Account = { id: `usr_${randomId(8)}`, email, isAdmin, createdAt: new Date().toISOString() };
      await db
        .prepare("INSERT INTO accounts (id, email, is_admin, created_at) VALUES (?, ?, ?, ?)")
        .bind(account.id, account.email, account.isAdmin ? 1 : 0, account.createdAt)
        .run();
      return account;
    },
  };
}

function rowToLoginCode(row: Record<string, unknown>): LoginCodeRecord {
  return {
    email: String(row.email),
    codeHash: String(row.code_hash),
    expiresAt: Number(row.expires_at),
    attempts: Number(row.attempts),
    consumedAt: row.consumed_at == null ? null : Number(row.consumed_at),
  };
}

export function createD1LoginCodeStore(db: D1Database): LoginCodeStore {
  return {
    async put(record) {
      // One row per email; a new request replaces the outstanding code.
      await db
        .prepare(
          "INSERT INTO login_codes (email, code_hash, expires_at, attempts, consumed_at) VALUES (?, ?, ?, ?, ?) " +
            "ON CONFLICT(email) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = excluded.attempts, consumed_at = excluded.consumed_at"
        )
        .bind(record.email, record.codeHash, record.expiresAt, record.attempts, record.consumedAt)
        .run();
    },
    async getByEmail(email) {
      const row = await db.prepare("SELECT * FROM login_codes WHERE email = ?").bind(email).first<Record<string, unknown>>();
      return row ? rowToLoginCode(row) : null;
    },
    async update(email, patch) {
      const sets: string[] = [];
      const values: unknown[] = [];
      if (patch.codeHash !== undefined) { sets.push("code_hash = ?"); values.push(patch.codeHash); }
      if (patch.expiresAt !== undefined) { sets.push("expires_at = ?"); values.push(patch.expiresAt); }
      if (patch.attempts !== undefined) { sets.push("attempts = ?"); values.push(patch.attempts); }
      if (patch.consumedAt !== undefined) { sets.push("consumed_at = ?"); values.push(patch.consumedAt); }
      if (sets.length === 0) return;
      values.push(email);
      await db.prepare(`UPDATE login_codes SET ${sets.join(", ")} WHERE email = ?`).bind(...values).run();
    },
  };
}

function rowToSession(row: Record<string, unknown>): SessionRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    expiresAt: Number(row.expires_at),
    createdAt: Number(row.created_at),
  };
}

export function createD1SessionStore(db: D1Database): SessionStore {
  return {
    async create({ userId, expiresAt }) {
      const session: SessionRecord = { id: `ses_${randomId(24)}`, userId, expiresAt, createdAt: Date.now() };
      await db
        .prepare("INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
        .bind(session.id, session.userId, session.expiresAt, session.createdAt)
        .run();
      return session;
    },
    async get(id) {
      const row = await db.prepare("SELECT * FROM sessions WHERE id = ?").bind(id).first<Record<string, unknown>>();
      return row ? rowToSession(row) : null;
    },
    async touch(id, expiresAt) {
      await db.prepare("UPDATE sessions SET expires_at = ? WHERE id = ?").bind(expiresAt, id).run();
    },
    async delete(id) {
      await db.prepare("DELETE FROM sessions WHERE id = ?").bind(id).run();
    },
  };
}
