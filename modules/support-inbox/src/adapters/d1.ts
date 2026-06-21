import type { SupportInboxConversationFilter, SupportInboxStore } from "../ports";
import type {
  ChannelConnection,
  ConversationChannel,
  InboxConversation,
  InboxMessage,
  SupportChannel,
  WidgetQuickAction,
  WidgetSettings
} from "../types";

const SETTINGS_COLS = "id, tenant_id, project_id, enabled, primary_color, position, greeting, placeholder, show_branding, created_at, updated_at";
const QUICK_ACTION_COLS = "id, tenant_id, project_id, label, type, value, sort_order, created_at";
const CONVERSATION_COLS =
  "id, tenant_id, project_id, session_id, status, channel, external_id, user_agent, referrer, page_url, ip_address, custom_data_json, agent_takeover, created_at, updated_at, resolved_at";
const MESSAGE_COLS = "id, tenant_id, conversation_id, role, content, tokens_used, sources_json, created_at";
const CHANNEL_COLS =
  "id, tenant_id, project_id, channel, external_account_id, display_name, display_phone, webhook_verify_token_ref, access_token_ref, status, created_at, updated_at";

function parseRecord(value: unknown): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function parseStringArray(value: unknown): string[] {
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

function toSettings(row: Record<string, unknown>): WidgetSettings {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    projectId: String(row.project_id),
    enabled: toBool(row.enabled),
    primaryColor: String(row.primary_color),
    position: String(row.position) as WidgetSettings["position"],
    greeting: String(row.greeting),
    placeholder: String(row.placeholder),
    showBranding: toBool(row.show_branding),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function toQuickAction(row: Record<string, unknown>): WidgetQuickAction {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    projectId: String(row.project_id),
    label: String(row.label),
    type: String(row.type) as WidgetQuickAction["type"],
    value: String(row.value),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: String(row.created_at)
  };
}

function toConversation(row: Record<string, unknown>): InboxConversation {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    projectId: String(row.project_id),
    sessionId: String(row.session_id),
    status: String(row.status) as InboxConversation["status"],
    channel: String(row.channel) as InboxConversation["channel"],
    externalId: row.external_id == null ? null : String(row.external_id),
    userAgent: row.user_agent == null ? null : String(row.user_agent),
    referrer: row.referrer == null ? null : String(row.referrer),
    pageUrl: row.page_url == null ? null : String(row.page_url),
    ipAddress: row.ip_address == null ? null : String(row.ip_address),
    customData: parseRecord(row.custom_data_json),
    agentTakeover: toBool(row.agent_takeover),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    resolvedAt: row.resolved_at == null ? null : String(row.resolved_at)
  };
}

function toMessage(row: Record<string, unknown>): InboxMessage {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    conversationId: String(row.conversation_id),
    role: String(row.role) as InboxMessage["role"],
    content: String(row.content),
    tokensUsed: Number(row.tokens_used ?? 0),
    sources: parseStringArray(row.sources_json),
    createdAt: String(row.created_at)
  };
}

function toChannelConnection(row: Record<string, unknown>): ChannelConnection {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    projectId: String(row.project_id),
    channel: String(row.channel) as SupportChannel,
    externalAccountId: String(row.external_account_id),
    displayName: row.display_name == null ? null : String(row.display_name),
    displayPhone: row.display_phone == null ? null : String(row.display_phone),
    webhookVerifyTokenRef: row.webhook_verify_token_ref == null ? null : String(row.webhook_verify_token_ref),
    accessTokenRef: row.access_token_ref == null ? null : String(row.access_token_ref),
    status: String(row.status) as ChannelConnection["status"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function createD1SupportInboxStore(db: D1Database): SupportInboxStore {
  return {
    async getWidgetSettings(tenantId, projectId) {
      const row = await db
        .prepare(`SELECT ${SETTINGS_COLS} FROM support_inbox_widget_settings WHERE tenant_id = ? AND project_id = ?`)
        .bind(tenantId, projectId)
        .first<Record<string, unknown>>();
      return row ? toSettings(row) : null;
    },

    async upsertWidgetSettings(settings) {
      await db
        .prepare(
          `INSERT INTO support_inbox_widget_settings (${SETTINGS_COLS})
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(tenant_id, project_id) DO UPDATE SET
             enabled = excluded.enabled,
             primary_color = excluded.primary_color,
             position = excluded.position,
             greeting = excluded.greeting,
             placeholder = excluded.placeholder,
             show_branding = excluded.show_branding,
             updated_at = excluded.updated_at`
        )
        .bind(
          settings.id,
          settings.tenantId,
          settings.projectId,
          settings.enabled ? 1 : 0,
          settings.primaryColor,
          settings.position,
          settings.greeting,
          settings.placeholder,
          settings.showBranding ? 1 : 0,
          settings.createdAt,
          settings.updatedAt
        )
        .run();
    },

    async createQuickAction(action) {
      await db
        .prepare(`INSERT INTO support_inbox_quick_actions (${QUICK_ACTION_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(action.id, action.tenantId, action.projectId, action.label, action.type, action.value, action.sortOrder, action.createdAt)
        .run();
    },

    async deleteQuickAction(tenantId, projectId, quickActionId) {
      const result = await db
        .prepare("DELETE FROM support_inbox_quick_actions WHERE tenant_id = ? AND project_id = ? AND id = ?")
        .bind(tenantId, projectId, quickActionId)
        .run();
      return (result.meta.changes ?? 0) > 0;
    },

    async listQuickActions(tenantId, projectId) {
      const result = await db
        .prepare(`SELECT ${QUICK_ACTION_COLS} FROM support_inbox_quick_actions WHERE tenant_id = ? AND project_id = ? ORDER BY sort_order ASC, created_at ASC`)
        .bind(tenantId, projectId)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(toQuickAction);
    },

    async getConversation(tenantId, conversationId) {
      const row = await db
        .prepare(`SELECT ${CONVERSATION_COLS} FROM support_inbox_conversations WHERE tenant_id = ? AND id = ?`)
        .bind(tenantId, conversationId)
        .first<Record<string, unknown>>();
      return row ? toConversation(row) : null;
    },

    async findActiveConversationBySession(tenantId, projectId, sessionId) {
      const row = await db
        .prepare(
          `SELECT ${CONVERSATION_COLS} FROM support_inbox_conversations
           WHERE tenant_id = ? AND project_id = ? AND session_id = ? AND status = 'active'
           ORDER BY created_at DESC LIMIT 1`
        )
        .bind(tenantId, projectId, sessionId)
        .first<Record<string, unknown>>();
      return row ? toConversation(row) : null;
    },

    async findActiveConversationByExternalId(tenantId, projectId, channel: ConversationChannel, externalId) {
      const row = await db
        .prepare(
          `SELECT ${CONVERSATION_COLS} FROM support_inbox_conversations
           WHERE tenant_id = ? AND project_id = ? AND channel = ? AND external_id = ? AND status = 'active'
           ORDER BY updated_at DESC LIMIT 1`
        )
        .bind(tenantId, projectId, channel, externalId)
        .first<Record<string, unknown>>();
      return row ? toConversation(row) : null;
    },

    async insertConversation(conversation) {
      await db
        .prepare(`INSERT INTO support_inbox_conversations (${CONVERSATION_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          conversation.id,
          conversation.tenantId,
          conversation.projectId,
          conversation.sessionId,
          conversation.status,
          conversation.channel,
          conversation.externalId,
          conversation.userAgent,
          conversation.referrer,
          conversation.pageUrl,
          conversation.ipAddress,
          JSON.stringify(conversation.customData),
          conversation.agentTakeover ? 1 : 0,
          conversation.createdAt,
          conversation.updatedAt,
          conversation.resolvedAt
        )
        .run();
    },

    async updateConversation(conversation) {
      await db
        .prepare(
          `UPDATE support_inbox_conversations
           SET status = ?, external_id = ?, user_agent = ?, referrer = ?, page_url = ?, ip_address = ?, custom_data_json = ?, agent_takeover = ?, updated_at = ?, resolved_at = ?
           WHERE tenant_id = ? AND id = ?`
        )
        .bind(
          conversation.status,
          conversation.externalId,
          conversation.userAgent,
          conversation.referrer,
          conversation.pageUrl,
          conversation.ipAddress,
          JSON.stringify(conversation.customData),
          conversation.agentTakeover ? 1 : 0,
          conversation.updatedAt,
          conversation.resolvedAt,
          conversation.tenantId,
          conversation.id
        )
        .run();
    },

    async listConversations(tenantId, filter?: SupportInboxConversationFilter) {
      const clauses = ["tenant_id = ?"];
      const binds: unknown[] = [tenantId];
      if (filter?.projectId) {
        clauses.push("project_id = ?");
        binds.push(filter.projectId);
      }
      if (filter?.status) {
        clauses.push("status = ?");
        binds.push(filter.status);
      }
      if (filter?.channel) {
        clauses.push("channel = ?");
        binds.push(filter.channel);
      }
      const where = clauses.join(" AND ");
      const limit = filter?.limit ?? 100;
      const offset = filter?.offset ?? 0;
      const [rows, count] = await Promise.all([
        db
          .prepare(`SELECT ${CONVERSATION_COLS} FROM support_inbox_conversations WHERE ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`)
          .bind(...binds, limit, offset)
          .all<Record<string, unknown>>(),
        db.prepare(`SELECT COUNT(*) AS count FROM support_inbox_conversations WHERE ${where}`).bind(...binds).first<{ count: number }>()
      ]);
      return { conversations: (rows.results ?? []).map(toConversation), total: Number(count?.count ?? 0) };
    },

    async insertMessage(message) {
      await db
        .prepare(`INSERT INTO support_inbox_messages (${MESSAGE_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          message.id,
          message.tenantId,
          message.conversationId,
          message.role,
          message.content,
          message.tokensUsed,
          JSON.stringify(message.sources),
          message.createdAt
        )
        .run();
    },

    async listMessages(tenantId, conversationId) {
      const result = await db
        .prepare(`SELECT ${MESSAGE_COLS} FROM support_inbox_messages WHERE tenant_id = ? AND conversation_id = ? ORDER BY created_at ASC`)
        .bind(tenantId, conversationId)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(toMessage);
    },

    async getChannelConnection(tenantId, projectId, channel) {
      const row = await db
        .prepare(`SELECT ${CHANNEL_COLS} FROM support_inbox_channel_connections WHERE tenant_id = ? AND project_id = ? AND channel = ?`)
        .bind(tenantId, projectId, channel)
        .first<Record<string, unknown>>();
      return row ? toChannelConnection(row) : null;
    },

    async upsertChannelConnection(connection) {
      await db
        .prepare(
          `INSERT INTO support_inbox_channel_connections (${CHANNEL_COLS})
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(tenant_id, project_id, channel) DO UPDATE SET
             external_account_id = excluded.external_account_id,
             display_name = excluded.display_name,
             display_phone = excluded.display_phone,
             webhook_verify_token_ref = excluded.webhook_verify_token_ref,
             access_token_ref = excluded.access_token_ref,
             status = excluded.status,
             updated_at = excluded.updated_at`
        )
        .bind(
          connection.id,
          connection.tenantId,
          connection.projectId,
          connection.channel,
          connection.externalAccountId,
          connection.displayName,
          connection.displayPhone,
          connection.webhookVerifyTokenRef,
          connection.accessTokenRef,
          connection.status,
          connection.createdAt,
          connection.updatedAt
        )
        .run();
    }
  };
}
