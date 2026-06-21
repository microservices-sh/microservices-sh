import { describe, expect, it } from "vitest";
import { createSequentialSupportInboxIdFactory, createSupportInboxMemoryStore, createSupportInboxService } from "./index";

const ctx = {
  tenantId: "tenant_1",
  actorId: "agent_1",
  now: "2026-06-21T00:00:00.000Z"
};

function createService() {
  const store = createSupportInboxMemoryStore();
  const createId = createSequentialSupportInboxIdFactory();
  return createSupportInboxService({ store, createId });
}

describe("support-inbox", () => {
  it("creates widget settings and returns quick actions sorted for the widget config", async () => {
    const service = createService();

    const settings = await service.upsertWidgetSettings(ctx, {
      projectId: "proj_1",
      primaryColor: "#00aa88",
      position: "bottom-left",
      greeting: "Need help?",
      showBranding: false
    });
    expect(settings.ok).toBe(true);
    expect(settings.data).toEqual(
      expect.objectContaining({
        id: "sinboxset_000001",
        primaryColor: "#00aa88",
        position: "bottom-left",
        showBranding: false
      })
    );

    await service.createQuickAction(ctx, {
      projectId: "proj_1",
      label: "Docs",
      type: "link",
      value: "https://example.com/docs",
      sortOrder: 20
    });
    const askBilling = await service.createQuickAction(ctx, {
      projectId: "proj_1",
      label: "Billing",
      type: "message",
      value: "I need help with billing",
      sortOrder: 10
    });

    const config = await service.getWidgetConfig(ctx, "proj_1");
    expect(config.data!.quickActions.map((action) => action.label)).toEqual(["Billing", "Docs"]);

    const deleted = await service.deleteQuickAction(ctx, {
      projectId: "proj_1",
      quickActionId: askBilling.data!.id
    });
    expect(deleted.data).toEqual({ deleted: true });
    const afterDelete = await service.getWidgetConfig(ctx, "proj_1");
    expect(afterDelete.data!.quickActions.map((action) => action.label)).toEqual(["Docs"]);
  });

  it("reuses active conversations, records messages, and pauses assistant replies during agent takeover", async () => {
    const service = createService();

    const conversation = await service.startConversation(ctx, {
      projectId: "proj_1",
      sessionId: "session_1",
      pageUrl: "https://example.com/pricing",
      customData: { plan: "pro" }
    });
    expect(conversation.data!.id).toBe("sinboxconv_000001");

    const reused = await service.startConversation(ctx, {
      projectId: "proj_1",
      sessionId: "session_1"
    });
    expect(reused.data!.id).toBe(conversation.data!.id);

    await service.addMessage(ctx, {
      conversationId: conversation.data!.id,
      role: "user",
      content: "Do you support WhatsApp?"
    });
    await service.addMessage(ctx, {
      conversationId: conversation.data!.id,
      role: "assistant",
      content: "Yes, WhatsApp can be configured through a channel connection.",
      sources: ["channels.md"]
    });

    const takeover = await service.setAgentTakeover(ctx, {
      conversationId: conversation.data!.id,
      enabled: true
    });
    expect(takeover.data!.agentTakeover).toBe(true);

    const blocked = await service.addMessage(ctx, {
      conversationId: conversation.data!.id,
      role: "assistant",
      content: "Automated reply"
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.error?.code).toBe("agent_takeover_active");

    const agentReply = await service.addMessage(ctx, {
      conversationId: conversation.data!.id,
      role: "agent",
      content: "An agent is now handling this."
    });
    expect(agentReply.ok).toBe(true);

    const thread = await service.getConversationThread(ctx, conversation.data!.id);
    expect(thread.data!.messages.map((message) => message.role)).toEqual(["user", "assistant", "agent"]);

    const resolved = await service.updateConversationStatus(ctx, {
      conversationId: conversation.data!.id,
      status: "resolved"
    });
    expect(resolved.data).toEqual(expect.objectContaining({ status: "resolved", resolvedAt: ctx.now }));

    const listed = await service.listConversations(ctx, { projectId: "proj_1", status: "resolved" });
    expect(listed.data!.total).toBe(1);
  });

  it("stores channel metadata with secret refs and reuses active external conversations", async () => {
    const service = createService();

    const connection = await service.configureChannelConnection(ctx, {
      projectId: "proj_1",
      channel: "whatsapp",
      externalAccountId: "waba_123",
      displayPhone: "+15550001",
      accessTokenRef: "secret:whatsapp/access-token",
      webhookVerifyTokenRef: "secret:whatsapp/verify-token",
      status: "active"
    });
    expect(connection.data).toEqual(
      expect.objectContaining({
        id: "sinboxchan_000001",
        accessTokenRef: "secret:whatsapp/access-token",
        status: "active"
      })
    );

    const started = await service.startConversation(ctx, {
      projectId: "proj_1",
      sessionId: "wa:+15550002",
      channel: "whatsapp",
      externalId: "+15550002"
    });
    const replay = await service.startConversation(ctx, {
      projectId: "proj_1",
      sessionId: "wa:+15550002:later",
      channel: "whatsapp",
      externalId: "+15550002"
    });

    expect(replay.data!.id).toBe(started.data!.id);
  });
});
