import type { SupportInboxConversationFilter, SupportInboxStore } from "../ports";
import type {
  AddMessageInput,
  ChannelConnection,
  ConfigureChannelConnectionInput,
  ConversationThread,
  CreateQuickActionInput,
  DeleteQuickActionInput,
  InboxConversation,
  InboxMessage,
  ListConversationsInput,
  ModuleResult,
  SetAgentTakeoverInput,
  StartConversationInput,
  SupportInboxIdFactory,
  SupportInboxIdPrefix,
  TenantContext,
  UpdateConversationStatusInput,
  UpsertWidgetSettingsInput,
  WidgetConfig,
  WidgetQuickAction,
  WidgetSettings
} from "../types";

export interface SupportInboxServiceDeps {
  store: SupportInboxStore;
  createId?: SupportInboxIdFactory;
}

export interface SupportInboxService {
  upsertWidgetSettings(ctx: TenantContext, input: UpsertWidgetSettingsInput): Promise<ModuleResult<WidgetSettings>>;
  createQuickAction(ctx: TenantContext, input: CreateQuickActionInput): Promise<ModuleResult<WidgetQuickAction>>;
  deleteQuickAction(ctx: TenantContext, input: DeleteQuickActionInput): Promise<ModuleResult<{ deleted: boolean }>>;
  getWidgetConfig(ctx: TenantContext, projectId: string): Promise<ModuleResult<WidgetConfig>>;
  startConversation(ctx: TenantContext, input: StartConversationInput): Promise<ModuleResult<InboxConversation>>;
  addMessage(ctx: TenantContext, input: AddMessageInput): Promise<ModuleResult<InboxMessage>>;
  listConversations(ctx: TenantContext, input?: ListConversationsInput): Promise<ModuleResult<{ conversations: InboxConversation[]; total: number }>>;
  getConversationThread(ctx: TenantContext, conversationId: string): Promise<ModuleResult<ConversationThread>>;
  updateConversationStatus(ctx: TenantContext, input: UpdateConversationStatusInput): Promise<ModuleResult<InboxConversation>>;
  setAgentTakeover(ctx: TenantContext, input: SetAgentTakeoverInput): Promise<ModuleResult<InboxConversation>>;
  configureChannelConnection(ctx: TenantContext, input: ConfigureChannelConnectionInput): Promise<ModuleResult<ChannelConnection>>;
}

function ok<T>(data: T): ModuleResult<T> {
  return { ok: true, data };
}

function fail<T>(code: string, message: string): ModuleResult<T> {
  return { ok: false, error: { code, message } };
}

function now(ctx: TenantContext): string {
  return ctx.now ?? new Date().toISOString();
}

function id(prefix: string, sequence: number): string {
  return `${prefix}_${sequence.toString().padStart(6, "0")}`;
}

export function createSequentialSupportInboxIdFactory(): SupportInboxIdFactory {
  const sequences: Record<SupportInboxIdPrefix, number> = {
    sinboxset: 0,
    sinboxqa: 0,
    sinboxconv: 0,
    sinboxmsg: 0,
    sinboxchan: 0
  };
  return (prefix) => id(prefix, ++sequences[prefix]);
}

function defaultId(prefix: SupportInboxIdPrefix): string {
  const uuid = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID?.();
  const randomId = uuid?.replaceAll("-", "") ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${randomId.slice(0, 24)}`;
}

function defaultWidgetSettings(ctx: TenantContext, projectId: string, createId: SupportInboxIdFactory, timestamp: string): WidgetSettings {
  return {
    id: createId("sinboxset"),
    tenantId: ctx.tenantId,
    projectId,
    enabled: true,
    primaryColor: "#7c3aed",
    position: "bottom-right",
    greeting: "Hi! How can I help you today?",
    placeholder: "Type your message...",
    showBranding: true,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeSources(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function limitFilter(input?: ListConversationsInput): SupportInboxConversationFilter {
  return {
    projectId: input?.projectId,
    status: input?.status,
    channel: input?.channel,
    limit: input?.limit && input.limit > 0 ? Math.floor(input.limit) : undefined,
    offset: input?.offset && input.offset > 0 ? Math.floor(input.offset) : undefined
  };
}

export function createSupportInboxService(deps: SupportInboxServiceDeps): SupportInboxService {
  const createId = deps.createId ?? defaultId;

  return {
    async upsertWidgetSettings(ctx, input) {
      if (!input.projectId.trim()) return fail("project_required", "Widget settings require a project id.");
      const timestamp = now(ctx);
      const existing = await deps.store.getWidgetSettings(ctx.tenantId, input.projectId);
      const base = existing ?? defaultWidgetSettings(ctx, input.projectId, createId, timestamp);
      const settings: WidgetSettings = {
        ...base,
        enabled: input.enabled ?? base.enabled,
        primaryColor: input.primaryColor?.trim() || base.primaryColor,
        position: input.position ?? base.position,
        greeting: input.greeting?.trim() || base.greeting,
        placeholder: input.placeholder?.trim() || base.placeholder,
        showBranding: input.showBranding ?? base.showBranding,
        updatedAt: timestamp
      };
      await deps.store.upsertWidgetSettings(settings);
      return ok(settings);
    },

    async createQuickAction(ctx, input) {
      if (!input.projectId.trim()) return fail("project_required", "Quick action requires a project id.");
      if (!input.label.trim()) return fail("label_required", "Quick action label is required.");
      if (!input.value.trim()) return fail("value_required", "Quick action value is required.");
      const action: WidgetQuickAction = {
        id: createId("sinboxqa"),
        tenantId: ctx.tenantId,
        projectId: input.projectId,
        label: input.label.trim(),
        type: input.type,
        value: input.value.trim(),
        sortOrder: input.sortOrder ?? 0,
        createdAt: now(ctx)
      };
      await deps.store.createQuickAction(action);
      return ok(action);
    },

    async deleteQuickAction(ctx, input) {
      if (!input.projectId.trim()) return fail("project_required", "Quick action delete requires a project id.");
      if (!input.quickActionId.trim()) return fail("quick_action_required", "Quick action id is required.");
      return ok({ deleted: await deps.store.deleteQuickAction(ctx.tenantId, input.projectId, input.quickActionId) });
    },

    async getWidgetConfig(ctx, projectId) {
      if (!projectId.trim()) return fail("project_required", "Widget config requires a project id.");
      const timestamp = now(ctx);
      let settings = await deps.store.getWidgetSettings(ctx.tenantId, projectId);
      if (!settings) {
        settings = defaultWidgetSettings(ctx, projectId, createId, timestamp);
        await deps.store.upsertWidgetSettings(settings);
      }
      const quickActions = await deps.store.listQuickActions(ctx.tenantId, projectId);
      return ok({ settings, quickActions });
    },

    async startConversation(ctx, input) {
      const projectId = input.projectId.trim();
      const sessionId = input.sessionId.trim();
      if (!projectId) return fail("project_required", "Conversation requires a project id.");
      if (!sessionId) return fail("session_required", "Conversation requires a visitor session id.");
      const channel = input.channel ?? "web";
      const externalId = trimOrNull(input.externalId);
      const existing = externalId
        ? await deps.store.findActiveConversationByExternalId(ctx.tenantId, projectId, channel, externalId)
        : await deps.store.findActiveConversationBySession(ctx.tenantId, projectId, sessionId);
      if (existing) return ok(existing);
      const timestamp = now(ctx);
      const conversation: InboxConversation = {
        id: createId("sinboxconv"),
        tenantId: ctx.tenantId,
        projectId,
        sessionId,
        status: "active",
        channel,
        externalId,
        userAgent: trimOrNull(input.userAgent),
        referrer: trimOrNull(input.referrer),
        pageUrl: trimOrNull(input.pageUrl),
        ipAddress: trimOrNull(input.ipAddress),
        customData: input.customData ?? {},
        agentTakeover: false,
        createdAt: timestamp,
        updatedAt: timestamp,
        resolvedAt: null
      };
      await deps.store.insertConversation(conversation);
      return ok(conversation);
    },

    async addMessage(ctx, input) {
      const conversation = await deps.store.getConversation(ctx.tenantId, input.conversationId);
      if (!conversation) return fail("conversation_not_found", "Support conversation not found.");
      if (conversation.status !== "active") return fail("conversation_closed", "Messages cannot be added to a non-active conversation.");
      if (conversation.agentTakeover && input.role === "assistant") {
        return fail("agent_takeover_active", "Assistant replies are paused while agent takeover is active.");
      }
      const content = input.content.trim();
      if (!content) return fail("message_required", "Message content is required.");
      const timestamp = now(ctx);
      const message: InboxMessage = {
        id: createId("sinboxmsg"),
        tenantId: ctx.tenantId,
        conversationId: conversation.id,
        role: input.role,
        content,
        tokensUsed: input.tokensUsed ?? 0,
        sources: normalizeSources(input.sources),
        createdAt: timestamp
      };
      await deps.store.insertMessage(message);
      await deps.store.updateConversation({ ...conversation, updatedAt: timestamp });
      return ok(message);
    },

    async listConversations(ctx, input) {
      return ok(await deps.store.listConversations(ctx.tenantId, limitFilter(input)));
    },

    async getConversationThread(ctx, conversationId) {
      const conversation = await deps.store.getConversation(ctx.tenantId, conversationId);
      if (!conversation) return fail("conversation_not_found", "Support conversation not found.");
      const messages = await deps.store.listMessages(ctx.tenantId, conversationId);
      return ok({ conversation, messages });
    },

    async updateConversationStatus(ctx, input) {
      const conversation = await deps.store.getConversation(ctx.tenantId, input.conversationId);
      if (!conversation) return fail("conversation_not_found", "Support conversation not found.");
      const timestamp = now(ctx);
      const updated: InboxConversation = {
        ...conversation,
        status: input.status,
        resolvedAt: input.status === "resolved" ? conversation.resolvedAt ?? timestamp : conversation.resolvedAt,
        updatedAt: timestamp
      };
      await deps.store.updateConversation(updated);
      return ok(updated);
    },

    async setAgentTakeover(ctx, input) {
      const conversation = await deps.store.getConversation(ctx.tenantId, input.conversationId);
      if (!conversation) return fail("conversation_not_found", "Support conversation not found.");
      const updated = { ...conversation, agentTakeover: input.enabled, updatedAt: now(ctx) };
      await deps.store.updateConversation(updated);
      return ok(updated);
    },

    async configureChannelConnection(ctx, input) {
      if (!input.projectId.trim()) return fail("project_required", "Channel connection requires a project id.");
      if (!input.externalAccountId.trim()) return fail("external_account_required", "Channel connection requires an external account id.");
      const existing = await deps.store.getChannelConnection(ctx.tenantId, input.projectId, input.channel);
      const timestamp = now(ctx);
      const connection: ChannelConnection = {
        id: existing?.id ?? createId("sinboxchan"),
        tenantId: ctx.tenantId,
        projectId: input.projectId,
        channel: input.channel,
        externalAccountId: input.externalAccountId.trim(),
        displayName: trimOrNull(input.displayName) ?? existing?.displayName ?? null,
        displayPhone: trimOrNull(input.displayPhone) ?? existing?.displayPhone ?? null,
        webhookVerifyTokenRef: trimOrNull(input.webhookVerifyTokenRef) ?? existing?.webhookVerifyTokenRef ?? null,
        accessTokenRef: trimOrNull(input.accessTokenRef) ?? existing?.accessTokenRef ?? null,
        status: input.status ?? existing?.status ?? "pending",
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp
      };
      await deps.store.upsertChannelConnection(connection);
      return ok(connection);
    }
  };
}

export function getSupportInboxModuleStatus() {
  return { id: "support-inbox", status: "draft" } as const;
}
