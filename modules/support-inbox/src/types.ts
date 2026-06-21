export interface SupportInboxConfig {
  enabled: boolean;
  maxConversationPageSize?: number;
}

export type SupportInboxIdPrefix = "sinboxset" | "sinboxqa" | "sinboxconv" | "sinboxmsg" | "sinboxchan";
export type SupportInboxIdFactory = (prefix: SupportInboxIdPrefix) => string;
export type WidgetPosition = "bottom-right" | "bottom-left";
export type QuickActionType = "link" | "message";
export type ConversationStatus = "active" | "resolved" | "archived";
export type ConversationChannel = "web" | "whatsapp";
export type MessageRole = "user" | "assistant" | "agent" | "system";
export type ChannelConnectionStatus = "pending" | "active" | "disconnected";
export type SupportChannel = "whatsapp";

export interface TenantContext {
  tenantId: string;
  actorId?: string;
  now?: string;
}

export interface WidgetSettings {
  id: string;
  tenantId: string;
  projectId: string;
  enabled: boolean;
  primaryColor: string;
  position: WidgetPosition;
  greeting: string;
  placeholder: string;
  showBranding: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WidgetQuickAction {
  id: string;
  tenantId: string;
  projectId: string;
  label: string;
  type: QuickActionType;
  value: string;
  sortOrder: number;
  createdAt: string;
}

export interface InboxConversation {
  id: string;
  tenantId: string;
  projectId: string;
  sessionId: string;
  status: ConversationStatus;
  channel: ConversationChannel;
  externalId: string | null;
  userAgent: string | null;
  referrer: string | null;
  pageUrl: string | null;
  ipAddress: string | null;
  customData: Record<string, unknown>;
  agentTakeover: boolean;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface InboxMessage {
  id: string;
  tenantId: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  tokensUsed: number;
  sources: string[];
  createdAt: string;
}

export interface ChannelConnection {
  id: string;
  tenantId: string;
  projectId: string;
  channel: SupportChannel;
  externalAccountId: string;
  displayName: string | null;
  displayPhone: string | null;
  webhookVerifyTokenRef: string | null;
  accessTokenRef: string | null;
  status: ChannelConnectionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface WidgetConfig {
  settings: WidgetSettings;
  quickActions: WidgetQuickAction[];
}

export interface ConversationThread {
  conversation: InboxConversation;
  messages: InboxMessage[];
}

export interface UpsertWidgetSettingsInput {
  projectId: string;
  enabled?: boolean;
  primaryColor?: string;
  position?: WidgetPosition;
  greeting?: string;
  placeholder?: string;
  showBranding?: boolean;
}

export interface CreateQuickActionInput {
  projectId: string;
  label: string;
  type: QuickActionType;
  value: string;
  sortOrder?: number;
}

export interface DeleteQuickActionInput {
  projectId: string;
  quickActionId: string;
}

export interface StartConversationInput {
  projectId: string;
  sessionId: string;
  channel?: ConversationChannel;
  externalId?: string | null;
  userAgent?: string | null;
  referrer?: string | null;
  pageUrl?: string | null;
  ipAddress?: string | null;
  customData?: Record<string, unknown>;
}

export interface AddMessageInput {
  conversationId: string;
  role: MessageRole;
  content: string;
  tokensUsed?: number;
  sources?: string[];
}

export interface ListConversationsInput {
  projectId?: string;
  status?: ConversationStatus;
  channel?: ConversationChannel;
  limit?: number;
  offset?: number;
}

export interface UpdateConversationStatusInput {
  conversationId: string;
  status: ConversationStatus;
}

export interface SetAgentTakeoverInput {
  conversationId: string;
  enabled: boolean;
}

export interface ConfigureChannelConnectionInput {
  projectId: string;
  channel: SupportChannel;
  externalAccountId: string;
  displayName?: string | null;
  displayPhone?: string | null;
  webhookVerifyTokenRef?: string | null;
  accessTokenRef?: string | null;
  status?: ChannelConnectionStatus;
}

export interface ModuleResult<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export type SupportInboxRecord =
  | WidgetSettings
  | WidgetQuickAction
  | InboxConversation
  | InboxMessage
  | ChannelConnection;
