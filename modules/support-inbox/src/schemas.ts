import { z } from "zod";

export const widgetPositionSchema = z.enum(["bottom-right", "bottom-left"]);
export const quickActionTypeSchema = z.enum(["link", "message"]);
export const conversationStatusSchema = z.enum(["active", "resolved", "archived"]);
export const conversationChannelSchema = z.enum(["web", "whatsapp"]);
export const messageRoleSchema = z.enum(["user", "assistant", "agent", "system"]);
export const supportChannelSchema = z.enum(["whatsapp"]);
export const channelConnectionStatusSchema = z.enum(["pending", "active", "disconnected"]);

export const supportInboxConfigSchema = z.object({
  enabled: z.boolean().default(true),
  maxConversationPageSize: z.number().int().positive().optional()
});

export const widgetSettingsSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  projectId: z.string().min(1),
  enabled: z.boolean(),
  primaryColor: z.string().min(1),
  position: widgetPositionSchema,
  greeting: z.string().min(1),
  placeholder: z.string().min(1),
  showBranding: z.boolean(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

export const widgetQuickActionSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  projectId: z.string().min(1),
  label: z.string().min(1),
  type: quickActionTypeSchema,
  value: z.string().min(1),
  sortOrder: z.number().int(),
  createdAt: z.string().min(1)
});

export const inboxConversationSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  projectId: z.string().min(1),
  sessionId: z.string().min(1),
  status: conversationStatusSchema,
  channel: conversationChannelSchema,
  externalId: z.string().nullable(),
  userAgent: z.string().nullable(),
  referrer: z.string().nullable(),
  pageUrl: z.string().nullable(),
  ipAddress: z.string().nullable(),
  customData: z.record(z.string(), z.unknown()),
  agentTakeover: z.boolean(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  resolvedAt: z.string().nullable()
});

export const inboxMessageSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  conversationId: z.string().min(1),
  role: messageRoleSchema,
  content: z.string().min(1),
  tokensUsed: z.number().int().nonnegative(),
  sources: z.array(z.string()),
  createdAt: z.string().min(1)
});

export const channelConnectionSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  projectId: z.string().min(1),
  channel: supportChannelSchema,
  externalAccountId: z.string().min(1),
  displayName: z.string().nullable(),
  displayPhone: z.string().nullable(),
  webhookVerifyTokenRef: z.string().nullable(),
  accessTokenRef: z.string().nullable(),
  status: channelConnectionStatusSchema,
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

export const supportInboxRecordSchema = z.union([
  widgetSettingsSchema,
  widgetQuickActionSchema,
  inboxConversationSchema,
  inboxMessageSchema,
  channelConnectionSchema
]);
