import type {
  ChannelConnection,
  ConversationChannel,
  ConversationStatus,
  InboxConversation,
  InboxMessage,
  SupportChannel,
  WidgetQuickAction,
  WidgetSettings
} from "../types";

export interface SupportInboxConversationFilter {
  projectId?: string;
  status?: ConversationStatus;
  channel?: ConversationChannel;
  limit?: number;
  offset?: number;
}

export interface SupportInboxStore {
  getWidgetSettings(tenantId: string, projectId: string): Promise<WidgetSettings | null>;
  upsertWidgetSettings(settings: WidgetSettings): Promise<void>;

  createQuickAction(action: WidgetQuickAction): Promise<void>;
  deleteQuickAction(tenantId: string, projectId: string, quickActionId: string): Promise<boolean>;
  listQuickActions(tenantId: string, projectId: string): Promise<WidgetQuickAction[]>;

  getConversation(tenantId: string, conversationId: string): Promise<InboxConversation | null>;
  findActiveConversationBySession(tenantId: string, projectId: string, sessionId: string): Promise<InboxConversation | null>;
  findActiveConversationByExternalId(tenantId: string, projectId: string, channel: ConversationChannel, externalId: string): Promise<InboxConversation | null>;
  insertConversation(conversation: InboxConversation): Promise<void>;
  updateConversation(conversation: InboxConversation): Promise<void>;
  listConversations(tenantId: string, filter?: SupportInboxConversationFilter): Promise<{ conversations: InboxConversation[]; total: number }>;

  insertMessage(message: InboxMessage): Promise<void>;
  listMessages(tenantId: string, conversationId: string): Promise<InboxMessage[]>;

  getChannelConnection(tenantId: string, projectId: string, channel: SupportChannel): Promise<ChannelConnection | null>;
  upsertChannelConnection(connection: ChannelConnection): Promise<void>;
}
