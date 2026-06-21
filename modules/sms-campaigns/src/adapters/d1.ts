import type { SmsCampaignListFilter, SmsCampaignsStore, SmsContactListFilter } from "../ports";
import type {
  SmsCampaign,
  SmsCampaignRecipient,
  SmsContact,
  SmsContactGroup,
  SmsDeliveryLog,
  SmsProviderConfig,
  SmsTemplate,
  SmsVendor
} from "../types";

const CONTACT_COLS = "id, tenant_id, phone, name, email, tags_json, opt_in, opt_in_date, created_at, updated_at, created_by";
const GROUP_COLS = "id, tenant_id, name, description, created_at, updated_at, created_by";
const TEMPLATE_COLS = "id, tenant_id, name, content, char_count, created_at, updated_at, created_by";
const PROVIDER_COLS =
  "id, tenant_id, vendor, is_default, is_enabled, api_key_ref, sender_id, quota_limit, quota_used, quota_reset_at, created_at, updated_at";
const CAMPAIGN_COLS =
  "id, tenant_id, name, template_id, vendor, status, send_type, scheduled_at, message, total_contacts, sent_count, delivered_count, failed_count, skipped_count, total_cost_cents, created_at, started_at, completed_at, updated_at, created_by";
const RECIPIENT_COLS =
  "id, tenant_id, campaign_id, contact_id, phone, status, vendor_message_id, cost_cents, error_message, sent_at, delivered_at, created_at, updated_at";
const LOG_COLS =
  "id, tenant_id, campaign_id, recipient_id, contact_id, phone, message, vendor, vendor_message_id, status, cost_cents, error_message, sent_at, delivered_at, created_at, updated_at";

function parseTags(value: unknown): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function toBool(value: unknown): boolean {
  return Number(value ?? 0) === 1;
}

function toContact(row: Record<string, unknown>): SmsContact {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    phone: String(row.phone),
    name: String(row.name),
    email: row.email == null ? null : String(row.email),
    tags: parseTags(row.tags_json),
    optIn: toBool(row.opt_in),
    optInDate: row.opt_in_date == null ? null : String(row.opt_in_date),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    createdBy: row.created_by == null ? null : String(row.created_by)
  };
}

function toGroup(row: Record<string, unknown>): SmsContactGroup {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    name: String(row.name),
    description: row.description == null ? null : String(row.description),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    createdBy: row.created_by == null ? null : String(row.created_by)
  };
}

function toTemplate(row: Record<string, unknown>): SmsTemplate {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    name: String(row.name),
    content: String(row.content),
    charCount: Number(row.char_count ?? 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    createdBy: row.created_by == null ? null : String(row.created_by)
  };
}

function toProvider(row: Record<string, unknown>): SmsProviderConfig {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    vendor: String(row.vendor) as SmsVendor,
    isDefault: toBool(row.is_default),
    isEnabled: toBool(row.is_enabled),
    apiKeyRef: row.api_key_ref == null ? null : String(row.api_key_ref),
    senderId: String(row.sender_id),
    quotaLimit: row.quota_limit == null ? null : Number(row.quota_limit),
    quotaUsed: Number(row.quota_used ?? 0),
    quotaResetAt: row.quota_reset_at == null ? null : String(row.quota_reset_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function toCampaign(row: Record<string, unknown>): SmsCampaign {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    name: String(row.name),
    templateId: row.template_id == null ? null : String(row.template_id),
    vendor: String(row.vendor) as SmsVendor,
    status: String(row.status) as SmsCampaign["status"],
    sendType: String(row.send_type) as SmsCampaign["sendType"],
    scheduledAt: row.scheduled_at == null ? null : String(row.scheduled_at),
    message: String(row.message),
    totalContacts: Number(row.total_contacts ?? 0),
    sentCount: Number(row.sent_count ?? 0),
    deliveredCount: Number(row.delivered_count ?? 0),
    failedCount: Number(row.failed_count ?? 0),
    skippedCount: Number(row.skipped_count ?? 0),
    totalCostCents: Number(row.total_cost_cents ?? 0),
    createdAt: String(row.created_at),
    startedAt: row.started_at == null ? null : String(row.started_at),
    completedAt: row.completed_at == null ? null : String(row.completed_at),
    updatedAt: String(row.updated_at),
    createdBy: row.created_by == null ? null : String(row.created_by)
  };
}

function toRecipient(row: Record<string, unknown>): SmsCampaignRecipient {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    campaignId: String(row.campaign_id),
    contactId: String(row.contact_id),
    phone: String(row.phone),
    status: String(row.status) as SmsCampaignRecipient["status"],
    vendorMessageId: row.vendor_message_id == null ? null : String(row.vendor_message_id),
    costCents: Number(row.cost_cents ?? 0),
    errorMessage: row.error_message == null ? null : String(row.error_message),
    sentAt: row.sent_at == null ? null : String(row.sent_at),
    deliveredAt: row.delivered_at == null ? null : String(row.delivered_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function toLog(row: Record<string, unknown>): SmsDeliveryLog {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    campaignId: row.campaign_id == null ? null : String(row.campaign_id),
    recipientId: row.recipient_id == null ? null : String(row.recipient_id),
    contactId: row.contact_id == null ? null : String(row.contact_id),
    phone: String(row.phone),
    message: String(row.message),
    vendor: String(row.vendor) as SmsVendor,
    vendorMessageId: row.vendor_message_id == null ? null : String(row.vendor_message_id),
    status: String(row.status) as SmsDeliveryLog["status"],
    costCents: Number(row.cost_cents ?? 0),
    errorMessage: row.error_message == null ? null : String(row.error_message),
    sentAt: row.sent_at == null ? null : String(row.sent_at),
    deliveredAt: row.delivered_at == null ? null : String(row.delivered_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function createD1SmsCampaignsStore(db: D1Database): SmsCampaignsStore {
  return {
    async getContact(tenantId, contactId) {
      const row = await db.prepare(`SELECT ${CONTACT_COLS} FROM sms_contacts WHERE tenant_id = ? AND id = ?`).bind(tenantId, contactId).first<Record<string, unknown>>();
      return row ? toContact(row) : null;
    },

    async findContactByPhone(tenantId, phone) {
      const row = await db.prepare(`SELECT ${CONTACT_COLS} FROM sms_contacts WHERE tenant_id = ? AND phone = ?`).bind(tenantId, phone).first<Record<string, unknown>>();
      return row ? toContact(row) : null;
    },

    async listContacts(tenantId, filter?: SmsContactListFilter) {
      const clauses = ["c.tenant_id = ?"];
      const binds: unknown[] = [tenantId];
      let join = "";
      if (filter?.groupId) {
        join = "JOIN sms_group_contacts gc ON gc.tenant_id = c.tenant_id AND gc.contact_id = c.id";
        clauses.push("gc.group_id = ?");
        binds.push(filter.groupId);
      }
      if (filter?.optIn != null) {
        clauses.push("c.opt_in = ?");
        binds.push(filter.optIn ? 1 : 0);
      }
      const result = await db
        .prepare(`SELECT ${CONTACT_COLS.split(", ").map((col) => `c.${col}`).join(", ")} FROM sms_contacts c ${join} WHERE ${clauses.join(" AND ")} ORDER BY c.created_at DESC`)
        .bind(...binds)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(toContact);
    },

    async upsertContact(contact) {
      await db
        .prepare(
          `INSERT INTO sms_contacts (${CONTACT_COLS})
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             phone = excluded.phone,
             name = excluded.name,
             email = excluded.email,
             tags_json = excluded.tags_json,
             opt_in = excluded.opt_in,
             opt_in_date = excluded.opt_in_date,
             updated_at = excluded.updated_at`
        )
        .bind(
          contact.id,
          contact.tenantId,
          contact.phone,
          contact.name,
          contact.email,
          JSON.stringify(contact.tags),
          contact.optIn ? 1 : 0,
          contact.optInDate,
          contact.createdAt,
          contact.updatedAt,
          contact.createdBy
        )
        .run();
    },

    async getGroup(tenantId, groupId) {
      const row = await db.prepare(`SELECT ${GROUP_COLS} FROM sms_contact_groups WHERE tenant_id = ? AND id = ?`).bind(tenantId, groupId).first<Record<string, unknown>>();
      return row ? toGroup(row) : null;
    },

    async createGroup(group) {
      await db.prepare(`INSERT INTO sms_contact_groups (${GROUP_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(group.id, group.tenantId, group.name, group.description, group.createdAt, group.updatedAt, group.createdBy)
        .run();
    },

    async listGroups(tenantId) {
      const result = await db.prepare(`SELECT ${GROUP_COLS} FROM sms_contact_groups WHERE tenant_id = ? ORDER BY created_at DESC`).bind(tenantId).all<Record<string, unknown>>();
      return (result.results ?? []).map(toGroup);
    },

    async setGroupContacts(tenantId, groupId, contactIds) {
      await db.prepare("DELETE FROM sms_group_contacts WHERE tenant_id = ? AND group_id = ?").bind(tenantId, groupId).run();
      if (contactIds.length === 0) return;
      await db.batch(
        contactIds.map((contactId) =>
          db.prepare("INSERT OR IGNORE INTO sms_group_contacts (tenant_id, group_id, contact_id, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)").bind(tenantId, groupId, contactId)
        )
      );
    },

    async listGroupContactIds(tenantId, groupId) {
      const result = await db.prepare("SELECT contact_id FROM sms_group_contacts WHERE tenant_id = ? AND group_id = ?").bind(tenantId, groupId).all<{ contact_id: string }>();
      return (result.results ?? []).map((row) => row.contact_id);
    },

    async getTemplate(tenantId, templateId) {
      const row = await db.prepare(`SELECT ${TEMPLATE_COLS} FROM sms_templates WHERE tenant_id = ? AND id = ?`).bind(tenantId, templateId).first<Record<string, unknown>>();
      return row ? toTemplate(row) : null;
    },

    async createTemplate(template) {
      await db.prepare(`INSERT INTO sms_templates (${TEMPLATE_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(template.id, template.tenantId, template.name, template.content, template.charCount, template.createdAt, template.updatedAt, template.createdBy)
        .run();
    },

    async listTemplates(tenantId) {
      const result = await db.prepare(`SELECT ${TEMPLATE_COLS} FROM sms_templates WHERE tenant_id = ? ORDER BY created_at DESC`).bind(tenantId).all<Record<string, unknown>>();
      return (result.results ?? []).map(toTemplate);
    },

    async getProviderConfig(tenantId, vendor) {
      const row = await db.prepare(`SELECT ${PROVIDER_COLS} FROM sms_provider_configs WHERE tenant_id = ? AND vendor = ?`).bind(tenantId, vendor).first<Record<string, unknown>>();
      return row ? toProvider(row) : null;
    },

    async upsertProviderConfig(config) {
      if (config.isDefault) {
        await db.prepare("UPDATE sms_provider_configs SET is_default = 0, updated_at = ? WHERE tenant_id = ? AND vendor <> ?").bind(config.updatedAt, config.tenantId, config.vendor).run();
      }
      await db
        .prepare(
          `INSERT INTO sms_provider_configs (${PROVIDER_COLS})
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(tenant_id, vendor) DO UPDATE SET
             is_default = excluded.is_default,
             is_enabled = excluded.is_enabled,
             api_key_ref = excluded.api_key_ref,
             sender_id = excluded.sender_id,
             quota_limit = excluded.quota_limit,
             quota_reset_at = excluded.quota_reset_at,
             updated_at = excluded.updated_at`
        )
        .bind(
          config.id,
          config.tenantId,
          config.vendor,
          config.isDefault ? 1 : 0,
          config.isEnabled ? 1 : 0,
          config.apiKeyRef,
          config.senderId,
          config.quotaLimit,
          config.quotaUsed,
          config.quotaResetAt,
          config.createdAt,
          config.updatedAt
        )
        .run();
    },

    async listProviderConfigs(tenantId) {
      const result = await db.prepare(`SELECT ${PROVIDER_COLS} FROM sms_provider_configs WHERE tenant_id = ? ORDER BY is_default DESC, vendor ASC`).bind(tenantId).all<Record<string, unknown>>();
      return (result.results ?? []).map(toProvider);
    },

    async getCampaign(tenantId, campaignId) {
      const row = await db.prepare(`SELECT ${CAMPAIGN_COLS} FROM sms_campaigns WHERE tenant_id = ? AND id = ?`).bind(tenantId, campaignId).first<Record<string, unknown>>();
      return row ? toCampaign(row) : null;
    },

    async insertCampaign(campaign) {
      await db.prepare(`INSERT INTO sms_campaigns (${CAMPAIGN_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          campaign.id,
          campaign.tenantId,
          campaign.name,
          campaign.templateId,
          campaign.vendor,
          campaign.status,
          campaign.sendType,
          campaign.scheduledAt,
          campaign.message,
          campaign.totalContacts,
          campaign.sentCount,
          campaign.deliveredCount,
          campaign.failedCount,
          campaign.skippedCount,
          campaign.totalCostCents,
          campaign.createdAt,
          campaign.startedAt,
          campaign.completedAt,
          campaign.updatedAt,
          campaign.createdBy
        )
        .run();
    },

    async updateCampaign(campaign) {
      await db.prepare(
        `UPDATE sms_campaigns
         SET status = ?, send_type = ?, scheduled_at = ?, total_contacts = ?, sent_count = ?, delivered_count = ?, failed_count = ?, skipped_count = ?, total_cost_cents = ?, started_at = ?, completed_at = ?, updated_at = ?
         WHERE tenant_id = ? AND id = ?`
      )
        .bind(
          campaign.status,
          campaign.sendType,
          campaign.scheduledAt,
          campaign.totalContacts,
          campaign.sentCount,
          campaign.deliveredCount,
          campaign.failedCount,
          campaign.skippedCount,
          campaign.totalCostCents,
          campaign.startedAt,
          campaign.completedAt,
          campaign.updatedAt,
          campaign.tenantId,
          campaign.id
        )
        .run();
    },

    async listCampaigns(tenantId, filter?: SmsCampaignListFilter) {
      const clauses = ["tenant_id = ?"];
      const binds: unknown[] = [tenantId];
      if (filter?.status) {
        clauses.push("status = ?");
        binds.push(filter.status);
      }
      if (filter?.dueAt) {
        clauses.push("scheduled_at IS NOT NULL", "scheduled_at <= ?");
        binds.push(filter.dueAt);
      }
      const sql = `SELECT ${CAMPAIGN_COLS} FROM sms_campaigns WHERE ${clauses.join(" AND ")} ORDER BY COALESCE(scheduled_at, created_at) ASC LIMIT ?`;
      const result = await db.prepare(sql).bind(...binds, filter?.limit ?? 100).all<Record<string, unknown>>();
      return (result.results ?? []).map(toCampaign);
    },

    async insertRecipients(recipients) {
      if (recipients.length === 0) return;
      await db.batch(
        recipients.map((recipient) =>
          db.prepare(`INSERT INTO sms_campaign_recipients (${RECIPIENT_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .bind(
              recipient.id,
              recipient.tenantId,
              recipient.campaignId,
              recipient.contactId,
              recipient.phone,
              recipient.status,
              recipient.vendorMessageId,
              recipient.costCents,
              recipient.errorMessage,
              recipient.sentAt,
              recipient.deliveredAt,
              recipient.createdAt,
              recipient.updatedAt
            )
        )
      );
    },

    async updateRecipient(recipient) {
      await db.prepare(
        `UPDATE sms_campaign_recipients
         SET status = ?, vendor_message_id = ?, cost_cents = ?, error_message = ?, sent_at = ?, delivered_at = ?, updated_at = ?
         WHERE tenant_id = ? AND id = ?`
      )
        .bind(
          recipient.status,
          recipient.vendorMessageId,
          recipient.costCents,
          recipient.errorMessage,
          recipient.sentAt,
          recipient.deliveredAt,
          recipient.updatedAt,
          recipient.tenantId,
          recipient.id
        )
        .run();
    },

    async listRecipients(tenantId, campaignId) {
      const result = await db.prepare(`SELECT ${RECIPIENT_COLS} FROM sms_campaign_recipients WHERE tenant_id = ? AND campaign_id = ? ORDER BY created_at ASC`).bind(tenantId, campaignId).all<Record<string, unknown>>();
      return (result.results ?? []).map(toRecipient);
    },

    async getDeliveryLogByVendorMessageId(tenantId, vendor, vendorMessageId) {
      const row = await db.prepare(`SELECT ${LOG_COLS} FROM sms_delivery_logs WHERE tenant_id = ? AND vendor = ? AND vendor_message_id = ?`).bind(tenantId, vendor, vendorMessageId).first<Record<string, unknown>>();
      return row ? toLog(row) : null;
    },

    async insertDeliveryLog(log) {
      await db.prepare(`INSERT INTO sms_delivery_logs (${LOG_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          log.id,
          log.tenantId,
          log.campaignId,
          log.recipientId,
          log.contactId,
          log.phone,
          log.message,
          log.vendor,
          log.vendorMessageId,
          log.status,
          log.costCents,
          log.errorMessage,
          log.sentAt,
          log.deliveredAt,
          log.createdAt,
          log.updatedAt
        )
        .run();
    },

    async updateDeliveryLog(log) {
      await db.prepare(
        `UPDATE sms_delivery_logs
         SET status = ?, cost_cents = ?, error_message = ?, sent_at = ?, delivered_at = ?, updated_at = ?
         WHERE tenant_id = ? AND id = ?`
      )
        .bind(log.status, log.costCents, log.errorMessage, log.sentAt, log.deliveredAt, log.updatedAt, log.tenantId, log.id)
        .run();
    },

    async listDeliveryLogs(tenantId, campaignId) {
      const result = await db.prepare(`SELECT ${LOG_COLS} FROM sms_delivery_logs WHERE tenant_id = ? AND campaign_id = ? ORDER BY created_at ASC`).bind(tenantId, campaignId).all<Record<string, unknown>>();
      return (result.results ?? []).map(toLog);
    }
  };
}
