import type { SmsCampaignsStore, SmsProvider } from "../ports";
import type {
  ConfigureSmsProviderInput,
  CreateSmsCampaignInput,
  CreateSmsGroupInput,
  CreateSmsTemplateInput,
  DispatchSmsCampaignInput,
  ModuleResult,
  RecordSmsDeliveryInput,
  ScheduleSmsCampaignInput,
  SmsCampaign,
  SmsCampaignRecipient,
  SmsCampaignReport,
  SmsCampaignsIdFactory,
  SmsCampaignsIdPrefix,
  SmsContact,
  SmsContactGroup,
  SmsDeliveryLog,
  SmsProviderConfig,
  SmsTemplate,
  TenantContext,
  UpsertSmsContactInput
} from "../types";

export interface SmsCampaignsServiceDeps {
  store: SmsCampaignsStore;
  createId?: SmsCampaignsIdFactory;
}

export interface SmsCampaignsService {
  upsertSmsContact(ctx: TenantContext, input: UpsertSmsContactInput): Promise<ModuleResult<SmsContact>>;
  listSmsContacts(ctx: TenantContext): Promise<ModuleResult<SmsContact[]>>;
  createSmsGroup(ctx: TenantContext, input: CreateSmsGroupInput): Promise<ModuleResult<SmsContactGroup>>;
  listSmsGroups(ctx: TenantContext): Promise<ModuleResult<SmsContactGroup[]>>;
  createSmsTemplate(ctx: TenantContext, input: CreateSmsTemplateInput): Promise<ModuleResult<SmsTemplate>>;
  listSmsTemplates(ctx: TenantContext): Promise<ModuleResult<SmsTemplate[]>>;
  configureSmsProvider(ctx: TenantContext, input: ConfigureSmsProviderInput): Promise<ModuleResult<SmsProviderConfig>>;
  listSmsProviderConfigs(ctx: TenantContext): Promise<ModuleResult<SmsProviderConfig[]>>;
  createSmsCampaign(ctx: TenantContext, input: CreateSmsCampaignInput): Promise<ModuleResult<{ campaign: SmsCampaign; recipients: SmsCampaignRecipient[] }>>;
  listSmsCampaigns(ctx: TenantContext): Promise<ModuleResult<SmsCampaign[]>>;
  scheduleSmsCampaign(ctx: TenantContext, input: ScheduleSmsCampaignInput): Promise<ModuleResult<SmsCampaign>>;
  listDueSmsCampaigns(ctx: TenantContext, dueAt: string, limit?: number): Promise<ModuleResult<SmsCampaign[]>>;
  dispatchSmsCampaign(ctx: TenantContext, input: DispatchSmsCampaignInput, provider: SmsProvider): Promise<ModuleResult<SmsCampaignReport>>;
  recordSmsDelivery(ctx: TenantContext, input: RecordSmsDeliveryInput): Promise<ModuleResult<SmsDeliveryLog>>;
  getSmsCampaignReport(ctx: TenantContext, campaignId: string): Promise<ModuleResult<SmsCampaignReport>>;
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

export function createSequentialSmsCampaignsIdFactory(): SmsCampaignsIdFactory {
  const sequences: Record<SmsCampaignsIdPrefix, number> = {
    smsct: 0,
    smsgrp: 0,
    smstpl: 0,
    smsprov: 0,
    smscamp: 0,
    smsrec: 0,
    smslog: 0
  };
  return (prefix) => id(prefix, ++sequences[prefix]);
}

function defaultId(prefix: SmsCampaignsIdPrefix): string {
  const uuid = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID?.();
  const randomId = uuid?.replaceAll("-", "") ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${randomId.slice(0, 24)}`;
}

function normalizePhone(phone: string): string {
  return phone.replace(/\s+/g, "").trim();
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function ensurePositiveInteger(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && value && value > 0 ? Math.floor(value) : fallback;
}

async function withStoreTransaction<T>(store: SmsCampaignsStore, operation: (transactionStore: SmsCampaignsStore) => Promise<T>) {
  return store.withTransaction ? store.withTransaction(operation) : operation(store);
}

async function resolveCampaignMessage(store: SmsCampaignsStore, ctx: TenantContext, input: CreateSmsCampaignInput): Promise<ModuleResult<string>> {
  const message = (input.message ?? "").trim();
  if (message) return ok(message);
  if (!input.templateId) return fail("message_required", "Campaign requires message text or a template.");
  const template = await store.getTemplate(ctx.tenantId, input.templateId);
  if (!template) return fail("template_not_found", "SMS template not found.");
  return ok(template.content);
}

async function resolveCampaignContacts(store: SmsCampaignsStore, ctx: TenantContext, input: CreateSmsCampaignInput): Promise<ModuleResult<SmsContact[]>> {
  const contactIds = unique(input.contactIds ?? []);
  for (const groupId of unique(input.groupIds ?? [])) {
    const group = await store.getGroup(ctx.tenantId, groupId);
    if (!group) return fail("group_not_found", `SMS contact group ${groupId} not found.`);
    contactIds.push(...(await store.listGroupContactIds(ctx.tenantId, groupId)));
  }

  const contacts: SmsContact[] = [];
  for (const contactId of unique(contactIds)) {
    const contact = await store.getContact(ctx.tenantId, contactId);
    if (!contact) return fail("contact_not_found", `SMS contact ${contactId} not found.`);
    contacts.push(contact);
  }
  if (contacts.length === 0) return fail("contacts_required", "Campaign requires at least one contact or group.");
  const optedIn = contacts.filter((contact) => contact.optIn);
  if (optedIn.length === 0) return fail("no_opted_in_contacts", "Campaign has no opted-in recipients.");
  return ok(optedIn);
}

function recipientStatusFromDelivery(status: SmsDeliveryLog["status"]): SmsCampaignRecipient["status"] {
  if (status === "failed") return "failed";
  if (status === "delivered") return "delivered";
  if (status === "sent") return "sent";
  return "queued";
}

function summarizeCampaign(campaign: SmsCampaign, recipients: SmsCampaignRecipient[], completedAt: string | null): SmsCampaign {
  const sentCount = recipients.filter((recipient) => recipient.status === "sent" || recipient.status === "delivered").length;
  const deliveredCount = recipients.filter((recipient) => recipient.status === "delivered").length;
  const failedCount = recipients.filter((recipient) => recipient.status === "failed").length;
  const skippedCount = recipients.filter((recipient) => recipient.status === "skipped").length;
  const totalCostCents = recipients.reduce((total, recipient) => total + recipient.costCents, 0);
  const pendingCount = recipients.filter((recipient) => recipient.status === "pending" || recipient.status === "queued").length;
  return {
    ...campaign,
    status: pendingCount === 0 ? (sentCount > 0 || deliveredCount > 0 ? "completed" : "failed") : campaign.status,
    sentCount,
    deliveredCount,
    failedCount,
    skippedCount,
    totalCostCents,
    completedAt: pendingCount === 0 ? completedAt : campaign.completedAt,
    updatedAt: completedAt ?? campaign.updatedAt
  };
}

export function createSmsCampaignsService(deps: SmsCampaignsServiceDeps): SmsCampaignsService {
  const createId = deps.createId ?? defaultId;

  return {
    async upsertSmsContact(ctx, input) {
      const phone = normalizePhone(input.phone);
      if (!phone) return fail("phone_required", "SMS contact phone is required.");
      if (!input.name.trim()) return fail("name_required", "SMS contact name is required.");
      const existing = input.id
        ? await deps.store.getContact(ctx.tenantId, input.id)
        : await deps.store.findContactByPhone(ctx.tenantId, phone);
      const timestamp = now(ctx);
      const contact: SmsContact = {
        id: existing?.id ?? input.id ?? createId("smsct"),
        tenantId: ctx.tenantId,
        phone,
        name: input.name.trim(),
        email: input.email?.trim() || null,
        tags: unique(input.tags ?? existing?.tags ?? []),
        optIn: input.optIn ?? existing?.optIn ?? true,
        optInDate: input.optIn === false ? null : input.optInDate ?? existing?.optInDate ?? timestamp,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
        createdBy: existing?.createdBy ?? ctx.actorId ?? null
      };
      await deps.store.upsertContact(contact);
      return ok(contact);
    },

    async listSmsContacts(ctx) {
      return ok(await deps.store.listContacts(ctx.tenantId));
    },

    async createSmsGroup(ctx, input) {
      if (!input.name.trim()) return fail("group_name_required", "SMS group name is required.");
      const timestamp = now(ctx);
      const group: SmsContactGroup = {
        id: createId("smsgrp"),
        tenantId: ctx.tenantId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        createdAt: timestamp,
        updatedAt: timestamp,
        createdBy: ctx.actorId ?? null
      };
      await withStoreTransaction(deps.store, async (store) => {
        await store.createGroup(group);
        await store.setGroupContacts(ctx.tenantId, group.id, unique(input.contactIds ?? []));
      });
      return ok(group);
    },

    async listSmsGroups(ctx) {
      return ok(await deps.store.listGroups(ctx.tenantId));
    },

    async createSmsTemplate(ctx, input) {
      const content = input.content.trim();
      if (!input.name.trim()) return fail("template_name_required", "SMS template name is required.");
      if (!content) return fail("template_content_required", "SMS template content is required.");
      const timestamp = now(ctx);
      const template: SmsTemplate = {
        id: createId("smstpl"),
        tenantId: ctx.tenantId,
        name: input.name.trim(),
        content,
        charCount: content.length,
        createdAt: timestamp,
        updatedAt: timestamp,
        createdBy: ctx.actorId ?? null
      };
      await deps.store.createTemplate(template);
      return ok(template);
    },

    async listSmsTemplates(ctx) {
      return ok(await deps.store.listTemplates(ctx.tenantId));
    },

    async configureSmsProvider(ctx, input) {
      if (!input.senderId.trim()) return fail("sender_required", "SMS sender id is required.");
      const existing = await deps.store.getProviderConfig(ctx.tenantId, input.vendor);
      const timestamp = now(ctx);
      const config: SmsProviderConfig = {
        id: existing?.id ?? createId("smsprov"),
        tenantId: ctx.tenantId,
        vendor: input.vendor,
        isDefault: input.isDefault ?? existing?.isDefault ?? false,
        isEnabled: input.isEnabled ?? existing?.isEnabled ?? true,
        apiKeyRef: input.apiKeyRef ?? existing?.apiKeyRef ?? null,
        senderId: input.senderId.trim(),
        quotaLimit: input.quotaLimit ?? existing?.quotaLimit ?? null,
        quotaUsed: existing?.quotaUsed ?? 0,
        quotaResetAt: input.quotaResetAt ?? existing?.quotaResetAt ?? null,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp
      };
      await deps.store.upsertProviderConfig(config);
      return ok(config);
    },

    async listSmsProviderConfigs(ctx) {
      return ok(await deps.store.listProviderConfigs(ctx.tenantId));
    },

    async createSmsCampaign(ctx, input) {
      const provider = await deps.store.getProviderConfig(ctx.tenantId, input.vendor);
      if (!provider || !provider.isEnabled) return fail("provider_not_enabled", "SMS provider is not configured or enabled.");
      const messageResult = await resolveCampaignMessage(deps.store, ctx, input);
      if (!messageResult.ok) return fail(messageResult.error?.code ?? "message_invalid", messageResult.error?.message ?? "Campaign message is invalid.");
      if (!messageResult.data) return fail("message_required", "Campaign requires message text or a template.");
      const contactsResult = await resolveCampaignContacts(deps.store, ctx, input);
      if (!contactsResult.ok) return fail(contactsResult.error?.code ?? "contacts_invalid", contactsResult.error?.message ?? "Campaign contacts are invalid.");
      if (!contactsResult.data) return fail("contacts_required", "Campaign requires at least one contact or group.");
      if (input.sendType === "scheduled" && !input.scheduledAt) {
        return fail("scheduled_at_required", "Scheduled SMS campaigns require a scheduledAt timestamp.");
      }
      const timestamp = now(ctx);
      const campaign: SmsCampaign = {
        id: createId("smscamp"),
        tenantId: ctx.tenantId,
        name: input.name.trim() || `SMS campaign ${timestamp}`,
        templateId: input.templateId ?? null,
        vendor: input.vendor,
        status: input.sendType === "scheduled" ? "scheduled" : "draft",
        sendType: input.sendType,
        scheduledAt: input.sendType === "scheduled" ? input.scheduledAt ?? null : null,
        message: messageResult.data,
        totalContacts: contactsResult.data.length,
        sentCount: 0,
        deliveredCount: 0,
        failedCount: 0,
        skippedCount: 0,
        totalCostCents: 0,
        createdAt: timestamp,
        startedAt: null,
        completedAt: null,
        updatedAt: timestamp,
        createdBy: ctx.actorId ?? null
      };
      const recipients = contactsResult.data.map((contact): SmsCampaignRecipient => ({
        id: createId("smsrec"),
        tenantId: ctx.tenantId,
        campaignId: campaign.id,
        contactId: contact.id,
        phone: contact.phone,
        status: "pending",
        vendorMessageId: null,
        costCents: 0,
        errorMessage: null,
        sentAt: null,
        deliveredAt: null,
        createdAt: timestamp,
        updatedAt: timestamp
      }));

      await withStoreTransaction(deps.store, async (store) => {
        await store.insertCampaign(campaign);
        await store.insertRecipients(recipients);
      });
      return ok({ campaign, recipients });
    },

    async listSmsCampaigns(ctx) {
      return ok(await deps.store.listCampaigns(ctx.tenantId));
    },

    async scheduleSmsCampaign(ctx, input) {
      const campaign = await deps.store.getCampaign(ctx.tenantId, input.campaignId);
      if (!campaign) return fail("campaign_not_found", "SMS campaign not found.");
      if (campaign.status === "cancelled" || campaign.status === "completed") {
        return fail("campaign_not_schedulable", "Campaign cannot be scheduled from its current status.");
      }
      const updated: SmsCampaign = {
        ...campaign,
        sendType: "scheduled",
        status: "scheduled",
        scheduledAt: input.scheduledAt,
        updatedAt: now(ctx)
      };
      await deps.store.updateCampaign(updated);
      return ok(updated);
    },

    async listDueSmsCampaigns(ctx, dueAt, limit) {
      return ok(await deps.store.listCampaigns(ctx.tenantId, { status: "scheduled", dueAt, limit }));
    },

    async dispatchSmsCampaign(ctx, input, provider) {
      const campaign = await deps.store.getCampaign(ctx.tenantId, input.campaignId);
      if (!campaign) return fail("campaign_not_found", "SMS campaign not found.");
      if (campaign.status === "cancelled" || campaign.status === "completed") {
        return fail("campaign_not_dispatchable", "Campaign cannot be dispatched from its current status.");
      }
      const providerConfig = await deps.store.getProviderConfig(ctx.tenantId, campaign.vendor);
      if (!providerConfig || !providerConfig.isEnabled) return fail("provider_not_enabled", "SMS provider is not configured or enabled.");

      const timestamp = now(ctx);
      let workingCampaign: SmsCampaign = { ...campaign, status: "sending", startedAt: campaign.startedAt ?? timestamp, updatedAt: timestamp };
      await deps.store.updateCampaign(workingCampaign);

      const recipients = await deps.store.listRecipients(ctx.tenantId, campaign.id);
      const batchSize = ensurePositiveInteger(input.batchSize, recipients.length || 1);
      const pendingRecipients = recipients.filter((recipient) => recipient.status === "pending").slice(0, batchSize);
      const updatedRecipients = new Map(recipients.map((recipient) => [recipient.id, recipient]));
      const logs: SmsDeliveryLog[] = [];

      for (const recipient of pendingRecipients) {
        try {
          const sent = await provider.sendMessage({
            tenantId: ctx.tenantId,
            campaignId: campaign.id,
            recipientId: recipient.id,
            to: recipient.phone,
            message: campaign.message,
            senderId: providerConfig.senderId,
            vendor: campaign.vendor
          });
          const status = sent.status ?? "sent";
          const updatedRecipient: SmsCampaignRecipient = {
            ...recipient,
            status: recipientStatusFromDelivery(status),
            vendorMessageId: sent.vendorMessageId,
            costCents: sent.costCents ?? 0,
            errorMessage: null,
            sentAt: status === "queued" ? null : timestamp,
            deliveredAt: status === "delivered" ? timestamp : null,
            updatedAt: timestamp
          };
          const log: SmsDeliveryLog = {
            id: createId("smslog"),
            tenantId: ctx.tenantId,
            campaignId: campaign.id,
            recipientId: recipient.id,
            contactId: recipient.contactId,
            phone: recipient.phone,
            message: campaign.message,
            vendor: campaign.vendor,
            vendorMessageId: sent.vendorMessageId,
            status,
            costCents: sent.costCents ?? 0,
            errorMessage: null,
            sentAt: status === "queued" ? null : timestamp,
            deliveredAt: status === "delivered" ? timestamp : null,
            createdAt: timestamp,
            updatedAt: timestamp
          };
          await deps.store.updateRecipient(updatedRecipient);
          await deps.store.insertDeliveryLog(log);
          updatedRecipients.set(updatedRecipient.id, updatedRecipient);
          logs.push(log);
        } catch (error) {
          const message = error instanceof Error ? error.message : "SMS provider send failed.";
          const updatedRecipient: SmsCampaignRecipient = {
            ...recipient,
            status: "failed",
            errorMessage: message,
            updatedAt: timestamp
          };
          const log: SmsDeliveryLog = {
            id: createId("smslog"),
            tenantId: ctx.tenantId,
            campaignId: campaign.id,
            recipientId: recipient.id,
            contactId: recipient.contactId,
            phone: recipient.phone,
            message: campaign.message,
            vendor: campaign.vendor,
            vendorMessageId: null,
            status: "failed",
            costCents: 0,
            errorMessage: message,
            sentAt: null,
            deliveredAt: null,
            createdAt: timestamp,
            updatedAt: timestamp
          };
          await deps.store.updateRecipient(updatedRecipient);
          await deps.store.insertDeliveryLog(log);
          updatedRecipients.set(updatedRecipient.id, updatedRecipient);
          logs.push(log);
        }
      }

      const finalRecipients = [...updatedRecipients.values()];
      workingCampaign = summarizeCampaign(workingCampaign, finalRecipients, now(ctx));
      await deps.store.updateCampaign(workingCampaign);
      return ok({ campaign: workingCampaign, recipients: finalRecipients, logs });
    },

    async recordSmsDelivery(ctx, input) {
      const existing = await deps.store.getDeliveryLogByVendorMessageId(ctx.tenantId, input.vendor, input.vendorMessageId);
      if (!existing) return fail("delivery_log_not_found", "SMS delivery log not found.");
      const timestamp = now(ctx);
      const updatedLog: SmsDeliveryLog = {
        ...existing,
        status: input.status,
        costCents: input.costCents ?? existing.costCents,
        errorMessage: input.errorMessage ?? null,
        deliveredAt: input.status === "delivered" ? input.deliveredAt ?? timestamp : existing.deliveredAt,
        updatedAt: timestamp
      };
      await deps.store.updateDeliveryLog(updatedLog);
      if (existing.recipientId && existing.campaignId) {
        const recipients = await deps.store.listRecipients(ctx.tenantId, existing.campaignId);
        const recipient = recipients.find((item) => item.id === existing.recipientId);
        if (recipient) {
          await deps.store.updateRecipient({
            ...recipient,
            status: recipientStatusFromDelivery(input.status),
            costCents: updatedLog.costCents,
            errorMessage: updatedLog.errorMessage,
            deliveredAt: updatedLog.deliveredAt,
            updatedAt: timestamp
          });
          const updatedRecipients = (await deps.store.listRecipients(ctx.tenantId, existing.campaignId));
          const campaign = await deps.store.getCampaign(ctx.tenantId, existing.campaignId);
          if (campaign) await deps.store.updateCampaign(summarizeCampaign(campaign, updatedRecipients, timestamp));
        }
      }
      return ok(updatedLog);
    },

    async getSmsCampaignReport(ctx, campaignId) {
      const campaign = await deps.store.getCampaign(ctx.tenantId, campaignId);
      if (!campaign) return fail("campaign_not_found", "SMS campaign not found.");
      const [recipients, logs] = await Promise.all([
        deps.store.listRecipients(ctx.tenantId, campaignId),
        deps.store.listDeliveryLogs(ctx.tenantId, campaignId)
      ]);
      return ok({ campaign, recipients, logs });
    }
  };
}

export function getSmsCampaignsModuleStatus() {
  return { id: "sms-campaigns", status: "draft" } as const;
}
