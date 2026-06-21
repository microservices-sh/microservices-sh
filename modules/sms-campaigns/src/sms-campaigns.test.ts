import { describe, expect, it } from "vitest";
import {
  createSequentialSmsCampaignsIdFactory,
  createSmsCampaignsMemoryStore,
  createSmsCampaignsService,
  type SmsProvider
} from "./index";

const ctx = {
  tenantId: "tenant_1",
  actorId: "user_1",
  now: "2026-06-21T00:00:00.000Z"
};

function createService() {
  const store = createSmsCampaignsMemoryStore();
  const createId = createSequentialSmsCampaignsIdFactory();
  return createSmsCampaignsService({ store, createId });
}

const memoryProvider: SmsProvider = {
  async sendMessage(input) {
    return {
      vendorMessageId: `msg_${input.recipientId}`,
      status: "sent",
      costCents: 8
    };
  }
};

describe("sms-campaigns", () => {
  it("filters opt-in recipients, schedules campaigns, dispatches SMS, and reconciles delivery callbacks", async () => {
    const service = createService();

    const providerConfig = await service.configureSmsProvider(ctx, {
      vendor: "memory",
      isDefault: true,
      senderId: "StackSuite"
    });
    expect(providerConfig.ok).toBe(true);

    const optedIn = await service.upsertSmsContact(ctx, {
      phone: "+1 555 0001",
      name: "Ada Lovelace",
      tags: ["vip"]
    });
    const optedOut = await service.upsertSmsContact(ctx, {
      phone: "+1 555 0002",
      name: "Grace Hopper",
      optIn: false
    });
    expect(optedIn.data!.phone).toBe("+15550001");

    const group = await service.createSmsGroup(ctx, {
      name: "VIPs",
      contactIds: [optedIn.data!.id, optedOut.data!.id]
    });
    const template = await service.createSmsTemplate(ctx, {
      name: "Flash sale",
      content: "Reply YES to confirm your appointment."
    });

    const created = await service.createSmsCampaign(ctx, {
      name: "Appointment confirmations",
      templateId: template.data!.id,
      vendor: "memory",
      sendType: "scheduled",
      scheduledAt: "2026-06-21T00:10:00.000Z",
      groupIds: [group.data!.id]
    });
    expect(created.ok).toBe(true);
    expect(created.data!.campaign.totalContacts).toBe(1);
    expect(created.data!.recipients).toEqual([
      expect.objectContaining({ contactId: optedIn.data!.id, status: "pending" })
    ]);

    const notDue = await service.listDueSmsCampaigns(ctx, "2026-06-21T00:05:00.000Z");
    expect(notDue.data).toEqual([]);

    const due = await service.listDueSmsCampaigns(ctx, "2026-06-21T00:10:00.000Z");
    expect(due.data).toEqual([expect.objectContaining({ id: created.data!.campaign.id })]);

    const dispatched = await service.dispatchSmsCampaign(ctx, { campaignId: created.data!.campaign.id }, memoryProvider);
    expect(dispatched.ok).toBe(true);
    expect(dispatched.data!.campaign).toEqual(
      expect.objectContaining({
        status: "completed",
        sentCount: 1,
        deliveredCount: 0,
        totalCostCents: 8
      })
    );

    const delivered = await service.recordSmsDelivery(ctx, {
      vendor: "memory",
      vendorMessageId: `msg_${created.data!.recipients[0].id}`,
      status: "delivered",
      costCents: 9,
      deliveredAt: "2026-06-21T00:11:00.000Z"
    });
    expect(delivered.ok).toBe(true);

    const report = await service.getSmsCampaignReport(ctx, created.data!.campaign.id);
    expect(report.data!.campaign).toEqual(
      expect.objectContaining({
        deliveredCount: 1,
        sentCount: 1,
        totalCostCents: 9
      })
    );
    expect(report.data!.logs).toHaveLength(1);
    expect(report.data!.recipients[0]).toEqual(
      expect.objectContaining({
        status: "delivered",
        deliveredAt: "2026-06-21T00:11:00.000Z"
      })
    );
  });

  it("keeps delivery callbacks idempotent by updating the existing vendor message log", async () => {
    const service = createService();
    await service.configureSmsProvider(ctx, { vendor: "memory", isDefault: true, senderId: "StackSuite" });
    const contact = await service.upsertSmsContact(ctx, { phone: "+1 555 0100", name: "Lin Chen" });
    const created = await service.createSmsCampaign(ctx, {
      name: "One contact",
      message: "Your order is ready.",
      vendor: "memory",
      sendType: "immediate",
      contactIds: [contact.data!.id]
    });
    await service.dispatchSmsCampaign(ctx, { campaignId: created.data!.campaign.id }, memoryProvider);

    const vendorMessageId = `msg_${created.data!.recipients[0].id}`;
    await service.recordSmsDelivery(ctx, { vendor: "memory", vendorMessageId, status: "delivered", costCents: 8 });
    await service.recordSmsDelivery(ctx, { vendor: "memory", vendorMessageId, status: "delivered", costCents: 8 });

    const report = await service.getSmsCampaignReport(ctx, created.data!.campaign.id);
    expect(report.data!.logs).toHaveLength(1);
    expect(report.data!.campaign.deliveredCount).toBe(1);
    expect(report.data!.campaign.totalCostCents).toBe(8);
  });

  it("rejects campaigns without any opted-in recipients", async () => {
    const service = createService();
    await service.configureSmsProvider(ctx, { vendor: "memory", isDefault: true, senderId: "StackSuite" });
    const optedOut = await service.upsertSmsContact(ctx, {
      phone: "+1 555 0200",
      name: "No SMS",
      optIn: false
    });

    const result = await service.createSmsCampaign(ctx, {
      name: "Invalid send",
      message: "This should not send.",
      vendor: "memory",
      sendType: "immediate",
      contactIds: [optedOut.data!.id]
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("no_opted_in_contacts");
  });
});
