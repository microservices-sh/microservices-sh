export { moduleDefinition, manifest } from "./manifest";
export { defaultConfig, configSchema } from "./config";
export {
  channelConnectionSchema,
  channelConnectionStatusSchema,
  conversationChannelSchema,
  conversationStatusSchema,
  inboxConversationSchema,
  inboxMessageSchema,
  messageRoleSchema,
  quickActionTypeSchema,
  supportChannelSchema,
  supportInboxConfigSchema,
  supportInboxRecordSchema,
  widgetPositionSchema,
  widgetQuickActionSchema,
  widgetSettingsSchema
} from "./schemas";
export { defaultSupportInboxHooks } from "./hooks";
export { events as supportInboxEvents } from "./events";
export { permissions as supportInboxPermissions } from "./permissions";
export { resources as supportInboxResources } from "./resources";
export { createSequentialSupportInboxIdFactory, createSupportInboxService, getSupportInboxModuleStatus } from "./service";
export { createD1SupportInboxStore } from "./adapters/d1";
export { createSupportInboxMemoryStore } from "./adapters/memory";
export type { SupportInboxHooks } from "./hooks";
export type { SupportInboxConversationFilter, SupportInboxStore } from "./ports";
export type { SupportInboxMemoryStoreState } from "./adapters/memory";
export type { SupportInboxService, SupportInboxServiceDeps } from "./service";
export type {
  AddMessageInput,
  ChannelConnection,
  ChannelConnectionStatus,
  ConfigureChannelConnectionInput,
  ConversationChannel,
  ConversationStatus,
  ConversationThread,
  CreateQuickActionInput,
  DeleteQuickActionInput,
  InboxConversation,
  InboxMessage,
  ListConversationsInput,
  MessageRole,
  ModuleResult,
  QuickActionType,
  SetAgentTakeoverInput,
  StartConversationInput,
  SupportChannel,
  SupportInboxConfig,
  SupportInboxIdFactory,
  SupportInboxIdPrefix,
  SupportInboxRecord,
  TenantContext,
  UpdateConversationStatusInput,
  UpsertWidgetSettingsInput,
  WidgetConfig,
  WidgetPosition,
  WidgetQuickAction,
  WidgetSettings
} from "./types";

export const supportInboxModule = {
  id: "support-inbox",
  version: "0.1.0"
} as const;
