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

export interface SupportInboxMemoryStoreState {
  widgetSettings?: WidgetSettings[];
  quickActions?: WidgetQuickAction[];
  conversations?: InboxConversation[];
  messages?: InboxMessage[];
  channelConnections?: ChannelConnection[];
}

function copy<T>(value: T): T {
  return structuredClone(value);
}

function projectKey(tenantId: string, projectId: string): string {
  return `${tenantId}:${projectId}`;
}

function channelKey(tenantId: string, projectId: string, channel: SupportChannel): string {
  return `${tenantId}:${projectId}:${channel}`;
}

function matchesFilter(conversation: InboxConversation, filter?: SupportInboxConversationFilter): boolean {
  if (filter?.projectId && conversation.projectId !== filter.projectId) return false;
  if (filter?.status && conversation.status !== filter.status) return false;
  if (filter?.channel && conversation.channel !== filter.channel) return false;
  return true;
}

export function createSupportInboxMemoryStore(initialState: SupportInboxMemoryStoreState = {}): SupportInboxStore {
  const settings = new Map<string, WidgetSettings>();
  const quickActions = new Map<string, WidgetQuickAction>();
  const conversations = new Map<string, InboxConversation>();
  const messages = new Map<string, InboxMessage>();
  const channelConnections = new Map<string, ChannelConnection>();

  for (const row of initialState.widgetSettings ?? []) settings.set(projectKey(row.tenantId, row.projectId), copy(row));
  for (const row of initialState.quickActions ?? []) quickActions.set(row.id, copy(row));
  for (const row of initialState.conversations ?? []) conversations.set(row.id, copy(row));
  for (const row of initialState.messages ?? []) messages.set(row.id, copy(row));
  for (const row of initialState.channelConnections ?? []) channelConnections.set(channelKey(row.tenantId, row.projectId, row.channel), copy(row));

  return {
    async getWidgetSettings(tenantId, projectId) {
      const row = settings.get(projectKey(tenantId, projectId));
      return row ? copy(row) : null;
    },

    async upsertWidgetSettings(row) {
      settings.set(projectKey(row.tenantId, row.projectId), copy(row));
    },

    async createQuickAction(action) {
      quickActions.set(action.id, copy(action));
    },

    async deleteQuickAction(tenantId, projectId, quickActionId) {
      const action = quickActions.get(quickActionId);
      if (!action || action.tenantId !== tenantId || action.projectId !== projectId) return false;
      quickActions.delete(quickActionId);
      return true;
    },

    async listQuickActions(tenantId, projectId) {
      return [...quickActions.values()]
        .filter((action) => action.tenantId === tenantId && action.projectId === projectId)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt))
        .map(copy);
    },

    async getConversation(tenantId, conversationId) {
      const conversation = conversations.get(conversationId);
      return conversation?.tenantId === tenantId ? copy(conversation) : null;
    },

    async findActiveConversationBySession(tenantId, projectId, sessionId) {
      const conversation = [...conversations.values()]
        .filter((row) => row.tenantId === tenantId && row.projectId === projectId && row.sessionId === sessionId && row.status === "active")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      return conversation ? copy(conversation) : null;
    },

    async findActiveConversationByExternalId(tenantId, projectId, channel: ConversationChannel, externalId) {
      const conversation = [...conversations.values()]
        .filter(
          (row) =>
            row.tenantId === tenantId &&
            row.projectId === projectId &&
            row.channel === channel &&
            row.externalId === externalId &&
            row.status === "active"
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
      return conversation ? copy(conversation) : null;
    },

    async insertConversation(conversation) {
      conversations.set(conversation.id, copy(conversation));
    },

    async updateConversation(conversation) {
      conversations.set(conversation.id, copy(conversation));
    },

    async listConversations(tenantId, filter) {
      const rows = [...conversations.values()]
        .filter((conversation) => conversation.tenantId === tenantId && matchesFilter(conversation, filter))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      const offset = filter?.offset ?? 0;
      const limit = filter?.limit ?? rows.length;
      return { conversations: rows.slice(offset, offset + limit).map(copy), total: rows.length };
    },

    async insertMessage(message) {
      messages.set(message.id, copy(message));
    },

    async listMessages(tenantId, conversationId) {
      const conversation = conversations.get(conversationId);
      if (!conversation || conversation.tenantId !== tenantId) return [];
      return [...messages.values()]
        .filter((message) => message.tenantId === tenantId && message.conversationId === conversationId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map(copy);
    },

    async getChannelConnection(tenantId, projectId, channel) {
      const row = channelConnections.get(channelKey(tenantId, projectId, channel));
      return row ? copy(row) : null;
    },

    async upsertChannelConnection(connection) {
      channelConnections.set(channelKey(connection.tenantId, connection.projectId, connection.channel), copy(connection));
    }
  };
}
