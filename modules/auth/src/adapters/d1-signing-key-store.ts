import type { SigningKeyStore } from "../ports";
import type { DomainEvent, SigningKey } from "../types";

function rowToKey(row: Record<string, unknown>): SigningKey {
  return {
    kid: String(row.kid),
    algorithm: "EdDSA",
    publicJwk: JSON.parse(String(row.public_jwk)) as JsonWebKey,
    privateJwk: JSON.parse(String(row.private_jwk)) as JsonWebKey,
    status: String(row.status) === "retired" ? "retired" : "active",
    createdAt: String(row.created_at),
    retiredAt: row.retired_at ? String(row.retired_at) : null
  };
}

export function createD1SigningKeyStore(db: D1Database): SigningKeyStore {
  return {
    async getActiveKey() {
      const row = await db
        .prepare("SELECT * FROM signing_keys WHERE status = 'active' ORDER BY created_at DESC LIMIT 1")
        .first<Record<string, unknown>>();
      return row ? rowToKey(row) : null;
    },

    async getKey(kid) {
      const row = await db.prepare("SELECT * FROM signing_keys WHERE kid = ?").bind(kid).first<Record<string, unknown>>();
      return row ? rowToKey(row) : null;
    },

    async listPublicKeys() {
      // Select only public columns — never read private_jwk into a result that
      // is published via JWKS.
      const result = await db
        .prepare(
          "SELECT kid, algorithm, public_jwk, status, created_at, retired_at FROM signing_keys ORDER BY created_at DESC LIMIT 10"
        )
        .all<Record<string, unknown>>();
      return (result.results ?? []).map((row) => ({
        kid: String(row.kid),
        algorithm: "EdDSA" as const,
        publicJwk: JSON.parse(String(row.public_jwk)) as JsonWebKey,
        status: String(row.status) === "retired" ? ("retired" as const) : ("active" as const),
        createdAt: String(row.created_at),
        retiredAt: row.retired_at ? String(row.retired_at) : null
      }));
    },

    async retireActiveKeys(retiredAt) {
      await db
        .prepare("UPDATE signing_keys SET status = 'retired', retired_at = ? WHERE status = 'active'")
        .bind(retiredAt)
        .run();
    },

    async putKey(key) {
      await db
        .prepare(
          "INSERT INTO signing_keys (kid, algorithm, public_jwk, private_jwk, status, created_at, retired_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(
          key.kid,
          key.algorithm,
          JSON.stringify(key.publicJwk),
          JSON.stringify(key.privateJwk),
          key.status,
          key.createdAt,
          key.retiredAt
        )
        .run();
    },

    async writeEvent(event: DomainEvent) {
      await db
        .prepare("INSERT INTO domain_events (id, event_name, entity_type, entity_id, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(
          `evt_${crypto.randomUUID().slice(0, 12)}`,
          event.eventName,
          event.entityType,
          event.entityId,
          JSON.stringify(event.payload),
          new Date().toISOString()
        )
        .run();
    }
  };
}
