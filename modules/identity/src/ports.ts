import type { Account, LoginCodeRecord, SessionRecord } from "./types";

// Persistence ports. Templates inject a D1-backed adapter in production and a memory
// adapter in tests/dev (same pattern as @microservices-sh/auth's SigningKeyStore).

export interface AccountStore {
  findByEmail(email: string): Promise<Account | null>;
  findById(id: string): Promise<Account | null>;
  create(input: { email: string; isAdmin?: boolean }): Promise<Account>;
}

export interface LoginCodeStore {
  // Upsert by email — a new request replaces any outstanding code.
  put(record: LoginCodeRecord): Promise<void>;
  getByEmail(email: string): Promise<LoginCodeRecord | null>;
  update(email: string, patch: Partial<LoginCodeRecord>): Promise<void>;
}

export interface SessionStore {
  create(input: { userId: string; expiresAt: number }): Promise<SessionRecord>;
  get(id: string): Promise<SessionRecord | null>;
  touch(id: string, expiresAt: number): Promise<void>;
  delete(id: string): Promise<void>;
}
