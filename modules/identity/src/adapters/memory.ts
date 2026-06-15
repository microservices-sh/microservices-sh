import { randomId } from "../crypto";
import type { AccountStore, LoginCodeStore, SessionStore } from "../ports";
import type { Account, LoginCodeRecord, SessionRecord } from "../types";

// In-memory adapters for tests + local dev without D1. Each returns copies so callers
// can't mutate stored state. D1-backed adapters mirror these against the identity
// schema (accounts / login_codes / sessions) — same shape, swappable.

export function createMemoryAccountStore(): AccountStore {
  const byId = new Map<string, Account>();
  const byEmail = new Map<string, string>();
  return {
    async findByEmail(email) {
      const id = byEmail.get(email);
      return id ? { ...byId.get(id)! } : null;
    },
    async findById(id) {
      const a = byId.get(id);
      return a ? { ...a } : null;
    },
    async create({ email, isAdmin = false }) {
      const existing = byEmail.get(email);
      if (existing) return { ...byId.get(existing)! };
      const account: Account = { id: `usr_${randomId(8)}`, email, isAdmin, createdAt: new Date(0).toISOString() };
      byId.set(account.id, account);
      byEmail.set(email, account.id);
      return { ...account };
    },
  };
}

export function createMemoryLoginCodeStore(): LoginCodeStore {
  const byEmail = new Map<string, LoginCodeRecord>();
  return {
    async put(record) {
      byEmail.set(record.email, { ...record });
    },
    async getByEmail(email) {
      const r = byEmail.get(email);
      return r ? { ...r } : null;
    },
    async update(email, patch) {
      const r = byEmail.get(email);
      if (r) byEmail.set(email, { ...r, ...patch });
    },
  };
}

export function createMemorySessionStore(): SessionStore {
  const byId = new Map<string, SessionRecord>();
  return {
    async create({ userId, expiresAt }) {
      const session: SessionRecord = { id: `ses_${randomId(24)}`, userId, expiresAt, createdAt: expiresAt };
      byId.set(session.id, session);
      return { ...session };
    },
    async get(id) {
      const s = byId.get(id);
      return s ? { ...s } : null;
    },
    async touch(id, expiresAt) {
      const s = byId.get(id);
      if (s) byId.set(id, { ...s, expiresAt });
    },
    async delete(id) {
      byId.delete(id);
    },
  };
}
