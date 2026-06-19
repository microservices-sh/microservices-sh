import type { PasskeyStore } from "../ports";
import type { ChallengeRecord, CredentialRecord } from "../types";

// D1-backed PasskeyStore. Same semantics as the memory adapter (memory-passkey-store.ts),
// against migrations/0001_passkey_auth.sql. Follows @microservices-sh/identity's D1
// adapter pattern: prepare().bind().first()/all()/run(). Real integration coverage lives
// in api/ (the monorepo Vitest runs in node env with no D1/miniflare harness).

function parseTransports(value: unknown): string[] {
  if (value == null) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function rowToChallenge(row: Record<string, unknown>): ChallengeRecord {
  return {
    challengeKey: String(row.challenge_key),
    challenge: String(row.challenge),
    userId: row.user_id == null ? null : String(row.user_id),
    createdAt: Number(row.created_at),
    expiresAt: Number(row.expires_at),
  };
}

function rowToCredential(row: Record<string, unknown>): CredentialRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    credentialId: String(row.credential_id),
    publicKey: String(row.public_key),
    counter: Number(row.counter),
    name: String(row.name),
    transports: parseTransports(row.transports),
    deviceType: row.device_type == null ? null : String(row.device_type),
    backedUp: Number(row.backed_up) === 1,
    createdAt: Number(row.created_at),
    lastUsedAt: row.last_used_at == null ? null : Number(row.last_used_at),
  };
}

export function createD1PasskeyStore(db: D1Database): PasskeyStore {
  return {
    async putChallenge(record) {
      // One row per challengeKey; a new ceremony replaces the outstanding challenge.
      await db
        .prepare(
          "INSERT INTO passkey_challenges (challenge_key, challenge, user_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?) " +
            "ON CONFLICT(challenge_key) DO UPDATE SET challenge = excluded.challenge, user_id = excluded.user_id, created_at = excluded.created_at, expires_at = excluded.expires_at"
        )
        .bind(record.challengeKey, record.challenge, record.userId, record.createdAt, record.expiresAt)
        .run();
    },
    async getChallenge(challengeKey) {
      const row = await db
        .prepare("SELECT * FROM passkey_challenges WHERE challenge_key = ?")
        .bind(challengeKey)
        .first<Record<string, unknown>>();
      return row ? rowToChallenge(row) : null;
    },
    async deleteChallenge(challengeKey) {
      await db.prepare("DELETE FROM passkey_challenges WHERE challenge_key = ?").bind(challengeKey).run();
    },

    async saveCredential(record) {
      await db
        .prepare(
          "INSERT INTO passkey_credentials (id, user_id, credential_id, public_key, counter, name, transports, device_type, backed_up, created_at, last_used_at) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(
          record.id,
          record.userId,
          record.credentialId,
          record.publicKey,
          record.counter,
          record.name,
          JSON.stringify(record.transports ?? []),
          record.deviceType,
          record.backedUp ? 1 : 0,
          record.createdAt,
          record.lastUsedAt
        )
        .run();
    },
    async getCredentialsByUser(userId) {
      const rows = await db
        .prepare("SELECT * FROM passkey_credentials WHERE user_id = ? ORDER BY created_at DESC")
        .bind(userId)
        .all<Record<string, unknown>>();
      return (rows.results ?? []).map(rowToCredential);
    },
    async getCredentialById(credentialId) {
      const row = await db
        .prepare("SELECT * FROM passkey_credentials WHERE credential_id = ?")
        .bind(credentialId)
        .first<Record<string, unknown>>();
      return row ? rowToCredential(row) : null;
    },
    async updateCounter(credentialId, counter, lastUsedAt) {
      await db
        .prepare("UPDATE passkey_credentials SET counter = ?, last_used_at = ? WHERE credential_id = ?")
        .bind(counter, lastUsedAt, credentialId)
        .run();
    },
    async deleteCredential(credentialId, userId) {
      const result = await db
        .prepare("DELETE FROM passkey_credentials WHERE credential_id = ? AND user_id = ?")
        .bind(credentialId, userId)
        .run();
      return (result.meta?.changes ?? 0) > 0;
    },
  };
}
