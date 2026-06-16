import type { EmailRepository } from "../ports";
import type { DomainEvent, EmailDelivery } from "../types";

interface EmailDeliveryRow {
  id: string;
  provider: string;
  provider_message_id: string | null;
  status: "queued" | "sent" | "failed";
  from_address: string;
  to_addresses: string;
  cc_addresses: string;
  bcc_addresses: string;
  subject: string;
  idempotency_key: string | null;
  metadata: string;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

function parseJsonRecord(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    return Object.fromEntries(Object.entries(parsed));
  } catch {
    return {};
  }
}

function parseJsonStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function toDelivery(row: EmailDeliveryRow): EmailDelivery {
  return {
    id: row.id,
    provider: row.provider,
    providerMessageId: row.provider_message_id,
    status: row.status,
    fromAddress: row.from_address,
    toAddresses: parseJsonStringArray(row.to_addresses),
    ccAddresses: parseJsonStringArray(row.cc_addresses),
    bccAddresses: parseJsonStringArray(row.bcc_addresses),
    subject: row.subject,
    idempotencyKey: row.idempotency_key,
    metadata: parseJsonRecord(row.metadata),
    errorCode: row.error_code,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function createD1EmailRepository(db: D1Database): EmailRepository {
  return {
    async recordDelivery(delivery) {
      await db
        .prepare(
          `INSERT OR REPLACE INTO email_deliveries (
            id,
            provider,
            provider_message_id,
            status,
            from_address,
            to_addresses,
            cc_addresses,
            bcc_addresses,
            subject,
            idempotency_key,
            metadata,
            error_code,
            error_message,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          delivery.id,
          delivery.provider,
          delivery.providerMessageId,
          delivery.status,
          delivery.fromAddress,
          JSON.stringify(delivery.toAddresses),
          JSON.stringify(delivery.ccAddresses),
          JSON.stringify(delivery.bccAddresses),
          delivery.subject,
          delivery.idempotencyKey,
          JSON.stringify(delivery.metadata),
          delivery.errorCode,
          delivery.errorMessage,
          delivery.createdAt,
          delivery.updatedAt
        )
        .run();
    },

    async getDelivery(id) {
      const row = await db
        .prepare(
          `SELECT
            id,
            provider,
            provider_message_id,
            status,
            from_address,
            to_addresses,
            cc_addresses,
            bcc_addresses,
            subject,
            idempotency_key,
            metadata,
            error_code,
            error_message,
            created_at,
            updated_at
          FROM email_deliveries
          WHERE id = ?`
        )
        .bind(id)
        .first<EmailDeliveryRow>();

      return row ? toDelivery(row) : null;
    },

    async listDeliveries(input = {}) {
      const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
      const result = input.recipient
        ? await db
            .prepare(
              `SELECT
                id,
                provider,
                provider_message_id,
                status,
                from_address,
                to_addresses,
                cc_addresses,
                bcc_addresses,
                subject,
                idempotency_key,
                metadata,
                error_code,
                error_message,
                created_at,
                updated_at
              FROM email_deliveries
              WHERE LOWER(to_addresses) LIKE ?
              ORDER BY created_at DESC
              LIMIT ?`
            )
            .bind(`%"${input.recipient.toLowerCase()}"%`, limit)
            .all<EmailDeliveryRow>()
        : await db
            .prepare(
              `SELECT
                id,
                provider,
                provider_message_id,
                status,
                from_address,
                to_addresses,
                cc_addresses,
                bcc_addresses,
                subject,
                idempotency_key,
                metadata,
                error_code,
                error_message,
                created_at,
                updated_at
              FROM email_deliveries
              ORDER BY created_at DESC
              LIMIT ?`
            )
            .bind(limit)
            .all<EmailDeliveryRow>();

      return (result.results ?? []).map(toDelivery);
    },

    async writeEvent(event: DomainEvent) {
      await db
        .prepare(
          `INSERT INTO domain_events (
            id,
            event_name,
            entity_type,
            entity_id,
            payload,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(
          `evt_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
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
