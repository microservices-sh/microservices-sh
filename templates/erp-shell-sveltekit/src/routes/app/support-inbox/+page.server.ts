import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { recordEvent } from "@microservices-sh/audit-log";
import {
  createSupportInboxService,
  getSupportInboxModuleStatus,
  type ConversationChannel,
  type ConversationStatus,
  type InboxConversation,
  type TenantContext
} from "@microservices-sh/support-inbox";
import { loadCompanyContext, requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

const REPORT_DATE = "2026-06-21T00:00:00.000Z";
const STATUSES = new Set<ConversationStatus>(["active", "resolved", "archived"]);
const CHANNELS = new Set<ConversationChannel>(["web", "whatsapp"]);

function text(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function optionalText(value: FormDataEntryValue | null): string | null {
  const next = text(value);
  return next.length > 0 ? next : null;
}

function statusFilter(value: string | null): ConversationStatus | undefined {
  return value && STATUSES.has(value as ConversationStatus) ? (value as ConversationStatus) : undefined;
}

function channelFilter(value: string | null): ConversationChannel | undefined {
  return value && CHANNELS.has(value as ConversationChannel) ? (value as ConversationChannel) : undefined;
}

function ctx(tenantId: string, actorId: string): TenantContext {
  return { tenantId, actorId, now: REPORT_DATE };
}

function conversationPayload(conversation: InboxConversation) {
  return {
    projectId: conversation.projectId,
    sessionId: conversation.sessionId,
    status: conversation.status,
    channel: conversation.channel,
    agentTakeover: conversation.agentTakeover
  };
}

async function seedDemoConversation({
  service,
  tenantContext,
  projectId,
  hasDb
}: {
  service: ReturnType<typeof createSupportInboxService>;
  tenantContext: TenantContext;
  projectId: string;
  hasDb: boolean;
}) {
  if (hasDb) return;
  const existing = await service.listConversations(tenantContext, { projectId, limit: 1 });
  if ((existing.data?.conversations ?? []).length > 0) return;

  const conversation = await service.startConversation(tenantContext, {
    projectId,
    sessionId: "demo-session",
    channel: "web",
    pageUrl: "/pricing",
    userAgent: "Demo visitor"
  });
  if (!conversation.ok || !conversation.data) return;
  await service.addMessage(tenantContext, {
    conversationId: conversation.data.id,
    role: "user",
    content: "Can someone confirm whether implementation support is included?"
  });
  await service.addMessage(tenantContext, {
    conversationId: conversation.data.id,
    role: "assistant",
    content: "Implementation support is available on paid plans. An agent can take over for contract details."
  });
}

async function requireManage({
  locals,
  cookies,
  platform
}: {
  locals: App.Locals;
  cookies: import("@sveltejs/kit").Cookies;
  platform?: App.Platform;
}) {
  requireModule("support-inbox", platform);
  if (!locals.user) return null;
  const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
  if (!org) return null;
  await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);
  return { org, tenantContext: ctx(org.id, locals.user.id), projectId: org.id };
}

export const load: PageServerLoad = async ({ locals, cookies, parent, platform, url }) => {
  requireModule("support-inbox", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);
  const service = createSupportInboxService({ store: locals.supportInboxStore });
  const tenantContext = ctx(activeOrgId, locals.user.id);
  const projectId = activeOrgId;
  await seedDemoConversation({ service, tenantContext, projectId, hasDb: Boolean(platform?.env?.DB) });

  const activeStatus = statusFilter(url.searchParams.get("status"));
  const activeChannel = channelFilter(url.searchParams.get("channel"));
  const [allConversationsResult, conversationsResult, widgetConfigResult] = await Promise.all([
    service.listConversations(tenantContext, { projectId, limit: 100 }),
    service.listConversations(tenantContext, {
      projectId,
      limit: 50,
      ...(activeStatus ? { status: activeStatus } : {}),
      ...(activeChannel ? { channel: activeChannel } : {})
    }),
    service.getWidgetConfig(tenantContext, projectId)
  ]);

  const allConversations = allConversationsResult.data?.conversations ?? [];
  const conversations = conversationsResult.data?.conversations ?? [];
  const selectedConversationId = text(url.searchParams.get("conversation")) || conversations[0]?.id || null;
  const threadResult = selectedConversationId ? await service.getConversationThread(tenantContext, selectedConversationId) : null;

  return {
    canManage: permissions.includes("*") || permissions.includes("member.manage"),
    status: getSupportInboxModuleStatus(),
    activeStatus: activeStatus ?? "all",
    activeChannel: activeChannel ?? "all",
    widget: widgetConfigResult.ok ? widgetConfigResult.data?.settings ?? null : null,
    conversations,
    metrics: {
      total: allConversations.length,
      active: allConversations.filter((conversation) => conversation.status === "active").length,
      resolved: allConversations.filter((conversation) => conversation.status === "resolved").length,
      takeover: allConversations.filter((conversation) => conversation.agentTakeover).length
    },
    selectedThread: threadResult?.ok ? threadResult.data : null
  };
};

export const actions: Actions = {
  startConversation: async ({ request, locals, cookies, platform }) => {
    const scoped = await requireManage({ locals, cookies, platform });
    if (!scoped || !locals.user) return fail(403, { error: "Not signed in to a company." });
    const form = await request.formData();
    const channel = text(form.get("channel"));
    const values = {
      sessionId: text(form.get("sessionId")) || `manual-${Date.now().toString(36)}`,
      channel,
      externalId: optionalText(form.get("externalId")),
      pageUrl: optionalText(form.get("pageUrl")),
      message: text(form.get("message"))
    };
    if (!CHANNELS.has(channel as ConversationChannel) || !values.message) {
      return fail(400, { error: "Choose a channel and enter the visitor message.", values });
    }

    const service = createSupportInboxService({ store: locals.supportInboxStore });
    const conversation = await service.startConversation(scoped.tenantContext, {
      projectId: scoped.projectId,
      sessionId: values.sessionId,
      channel: channel as ConversationChannel,
      externalId: values.externalId,
      pageUrl: values.pageUrl
    });
    if (!conversation.ok || !conversation.data) {
      return fail(400, { error: conversation.error?.message ?? "Could not start conversation.", values });
    }

    const message = await service.addMessage(scoped.tenantContext, {
      conversationId: conversation.data.id,
      role: "user",
      content: values.message
    });
    if (!message.ok) return fail(400, { error: message.error?.message ?? "Could not add visitor message.", values });

    await recordEvent(
      {
        eventName: "support-inbox.conversation_started",
        actorId: locals.user.id,
        entityType: "support_inbox_conversation",
        entityId: conversation.data.id,
        source: "app/support-inbox",
        payload: conversationPayload(conversation.data)
      },
      { auditStore: locals.auditStore }
    );

    return { conversationStarted: true, conversationId: conversation.data.id };
  },

  addAgentMessage: async ({ request, locals, cookies, platform }) => {
    const scoped = await requireManage({ locals, cookies, platform });
    if (!scoped || !locals.user) return fail(403, { error: "Not signed in to a company." });
    const form = await request.formData();
    const values = {
      conversationId: text(form.get("conversationId")),
      content: text(form.get("content"))
    };
    if (!values.conversationId || !values.content) return fail(400, { error: "Choose a conversation and enter a reply.", values });

    const service = createSupportInboxService({ store: locals.supportInboxStore });
    const message = await service.addMessage(scoped.tenantContext, {
      conversationId: values.conversationId,
      role: "agent",
      content: values.content
    });
    if (!message.ok || !message.data) return fail(400, { error: message.error?.message ?? "Could not add agent reply.", values });

    await recordEvent(
      {
        eventName: "support-inbox.message_added",
        actorId: locals.user.id,
        entityType: "support_inbox_message",
        entityId: message.data.id,
        source: "app/support-inbox",
        payload: { conversationId: values.conversationId, role: "agent" }
      },
      { auditStore: locals.auditStore }
    );

    return { agentMessageAdded: true, conversationId: values.conversationId };
  },

  setAgentTakeover: async ({ request, locals, cookies, platform }) => {
    const scoped = await requireManage({ locals, cookies, platform });
    if (!scoped || !locals.user) return fail(403, { error: "Not signed in to a company." });
    const form = await request.formData();
    const values = {
      conversationId: text(form.get("conversationId")),
      enabled: text(form.get("enabled"))
    };
    if (!values.conversationId || (values.enabled !== "true" && values.enabled !== "false")) {
      return fail(400, { error: "Choose a conversation and takeover state.", values });
    }

    const service = createSupportInboxService({ store: locals.supportInboxStore });
    const conversation = await service.setAgentTakeover(scoped.tenantContext, {
      conversationId: values.conversationId,
      enabled: values.enabled === "true"
    });
    if (!conversation.ok || !conversation.data) {
      return fail(400, { error: conversation.error?.message ?? "Could not update takeover state.", values });
    }

    await recordEvent(
      {
        eventName: "support-inbox.agent_takeover_updated",
        actorId: locals.user.id,
        entityType: "support_inbox_conversation",
        entityId: conversation.data.id,
        source: "app/support-inbox",
        payload: conversationPayload(conversation.data)
      },
      { auditStore: locals.auditStore }
    );

    return { takeoverUpdated: true, conversationId: conversation.data.id };
  },

  updateStatus: async ({ request, locals, cookies, platform }) => {
    const scoped = await requireManage({ locals, cookies, platform });
    if (!scoped || !locals.user) return fail(403, { error: "Not signed in to a company." });
    const form = await request.formData();
    const status = text(form.get("status"));
    const values = {
      conversationId: text(form.get("conversationId")),
      status
    };
    if (!values.conversationId || !STATUSES.has(status as ConversationStatus)) {
      return fail(400, { error: "Choose a conversation and valid status.", values });
    }

    const service = createSupportInboxService({ store: locals.supportInboxStore });
    const conversation = await service.updateConversationStatus(scoped.tenantContext, {
      conversationId: values.conversationId,
      status: status as ConversationStatus
    });
    if (!conversation.ok || !conversation.data) {
      return fail(400, { error: conversation.error?.message ?? "Could not update conversation status.", values });
    }

    await recordEvent(
      {
        eventName: "support-inbox.conversation_status_updated",
        actorId: locals.user.id,
        entityType: "support_inbox_conversation",
        entityId: conversation.data.id,
        source: "app/support-inbox",
        payload: conversationPayload(conversation.data)
      },
      { auditStore: locals.auditStore }
    );

    return { statusUpdated: true, conversationId: conversation.data.id };
  }
};
