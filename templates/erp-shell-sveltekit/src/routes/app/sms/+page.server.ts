import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { recordEvent } from "@microservices-sh/audit-log";
import {
  createSmsCampaignsService,
  getSmsCampaignsModuleStatus,
  type SmsProvider,
  type SmsVendor
} from "@microservices-sh/sms-campaigns";
import { requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

function text(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function optionalText(value: FormDataEntryValue | null): string | null {
  const next = text(value);
  return next.length > 0 ? next : null;
}

function tags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function isSmsVendor(value: string): value is SmsVendor {
  return value === "memory" || value === "twilio" || value === "clicksend" || value === "sns";
}

const previewProvider: SmsProvider = {
  async sendMessage(input) {
    return {
      vendorMessageId: `preview_${input.recipientId}`,
      status: "sent",
      costCents: 8
    };
  }
};

async function requireManage({ locals, cookies, platform }: { locals: App.Locals; cookies: import("@sveltejs/kit").Cookies; platform?: App.Platform }) {
  requireModule("sms-campaigns", platform);
  if (!locals.user) return null;
  const { loadCompanyContext, requireOrgPermission } = await import("$lib/server/org-context");
  const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
  if (!org) return null;
  await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);
  return { org, ctx: { tenantId: org.id, actorId: locals.user.id } };
}

export const load: PageServerLoad = async ({ locals, cookies, parent, platform, url }) => {
  requireModule("sms-campaigns", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);
  const service = createSmsCampaignsService({ store: locals.smsCampaignsStore });
  const ctx = { tenantId: activeOrgId, actorId: locals.user.id, now: "2026-06-21T00:00:00.000Z" };

  const seedDemoData = !platform?.env?.DB;
  if (seedDemoData) {
    const [contacts, templates, providers, campaigns] = await Promise.all([
      service.listSmsContacts(ctx),
      service.listSmsTemplates(ctx),
      service.listSmsProviderConfigs(ctx),
      service.listSmsCampaigns(ctx)
    ]);
    if ((providers.data ?? []).length === 0) {
      await service.configureSmsProvider(ctx, { vendor: "memory", isDefault: true, senderId: "StackSuite" });
    }
    if ((contacts.data ?? []).length === 0) {
      await service.upsertSmsContact(ctx, { phone: "+1 555 0101", name: "Ada Lovelace", tags: ["vip", "demo"] });
      await service.upsertSmsContact(ctx, { phone: "+1 555 0102", name: "Grace Hopper", optIn: false, tags: ["demo"] });
    }
    if ((templates.data ?? []).length === 0) {
      await service.createSmsTemplate(ctx, {
        name: "Appointment reminder",
        content: "Hi {{name}}, reply YES to confirm your appointment."
      });
    }
    if ((campaigns.data ?? []).length === 0) {
      const nextContacts = await service.listSmsContacts(ctx);
      const nextTemplates = await service.listSmsTemplates(ctx);
      const optedIn = (nextContacts.data ?? []).filter((contact) => contact.optIn);
      if (optedIn.length > 0 && nextTemplates.data?.[0]) {
        await service.createSmsCampaign(ctx, {
          name: "Demo reminders",
          templateId: nextTemplates.data[0].id,
          vendor: "memory",
          sendType: "scheduled",
          scheduledAt: "2026-06-21T00:10:00.000Z",
          contactIds: optedIn.map((contact) => contact.id)
        });
      }
    }
  }

  const [contacts, groups, templates, providers, campaigns] = await Promise.all([
    service.listSmsContacts(ctx),
    service.listSmsGroups(ctx),
    service.listSmsTemplates(ctx),
    service.listSmsProviderConfigs(ctx),
    service.listSmsCampaigns(ctx)
  ]);
  const campaignList = campaigns.data ?? [];
  const selectedCampaignId = url.searchParams.get("campaign") ?? campaignList[0]?.id ?? null;
  const report = selectedCampaignId ? await service.getSmsCampaignReport(ctx, selectedCampaignId) : null;

  return {
    canManage: permissions.includes("*") || permissions.includes("member.manage"),
    status: getSmsCampaignsModuleStatus(),
    contacts: contacts.data ?? [],
    groups: groups.data ?? [],
    templates: templates.data ?? [],
    providers: providers.data ?? [],
    campaigns: campaignList,
    selectedCampaignId,
    report: report?.ok ? report.data : null
  };
};

export const actions: Actions = {
  createContact: async ({ request, locals, cookies, platform }) => {
    const scoped = await requireManage({ locals, cookies, platform });
    if (!scoped || !locals.user) return fail(403, { error: "Not signed in to a company." });
    const form = await request.formData();
    const values = {
      name: text(form.get("name")),
      phone: text(form.get("phone")),
      email: optionalText(form.get("email")),
      tags: text(form.get("tags")),
      optIn: form.get("optIn") === "on"
    };
    if (!values.name || !values.phone) return fail(400, { error: "Enter a contact name and phone number.", values });

    const service = createSmsCampaignsService({ store: locals.smsCampaignsStore });
    const contact = await service.upsertSmsContact(scoped.ctx, {
      name: values.name,
      phone: values.phone,
      email: values.email,
      tags: tags(values.tags),
      optIn: values.optIn
    });
    if (!contact.ok || !contact.data) return fail(400, { error: contact.error?.message ?? "Could not save SMS contact.", values });

    await recordEvent(
      {
        eventName: "sms-campaigns.contact_upserted",
        actorId: locals.user.id,
        entityType: "sms_contact",
        entityId: contact.data.id,
        source: "app/sms",
        payload: { phone: contact.data.phone, optIn: contact.data.optIn, tags: contact.data.tags }
      },
      { auditStore: locals.auditStore }
    );
    return { contactCreated: true };
  },

  createTemplate: async ({ request, locals, cookies, platform }) => {
    const scoped = await requireManage({ locals, cookies, platform });
    if (!scoped || !locals.user) return fail(403, { error: "Not signed in to a company." });
    const form = await request.formData();
    const values = { name: text(form.get("name")), content: text(form.get("content")) };
    if (!values.name || !values.content) return fail(400, { error: "Enter a template name and message content.", values });

    const service = createSmsCampaignsService({ store: locals.smsCampaignsStore });
    const template = await service.createSmsTemplate(scoped.ctx, values);
    if (!template.ok || !template.data) return fail(400, { error: template.error?.message ?? "Could not create SMS template.", values });

    await recordEvent(
      {
        eventName: "sms-campaigns.template_created",
        actorId: locals.user.id,
        entityType: "sms_template",
        entityId: template.data.id,
        source: "app/sms",
        payload: { name: template.data.name, charCount: template.data.charCount }
      },
      { auditStore: locals.auditStore }
    );
    return { templateCreated: true };
  },

  configureProvider: async ({ request, locals, cookies, platform }) => {
    const scoped = await requireManage({ locals, cookies, platform });
    if (!scoped || !locals.user) return fail(403, { error: "Not signed in to a company." });
    const form = await request.formData();
    const vendor = text(form.get("vendor"));
    const values = {
      vendor,
      senderId: text(form.get("senderId")),
      apiKeyRef: optionalText(form.get("apiKeyRef")),
      isDefault: form.get("isDefault") === "on",
      isEnabled: form.get("isEnabled") === "on"
    };
    if (!isSmsVendor(vendor) || !values.senderId) return fail(400, { error: "Choose a provider and enter a sender id.", values });

    const service = createSmsCampaignsService({ store: locals.smsCampaignsStore });
    const provider = await service.configureSmsProvider(scoped.ctx, {
      vendor,
      senderId: values.senderId,
      apiKeyRef: values.apiKeyRef,
      isDefault: values.isDefault,
      isEnabled: values.isEnabled
    });
    if (!provider.ok || !provider.data) return fail(400, { error: provider.error?.message ?? "Could not configure SMS provider.", values });

    await recordEvent(
      {
        eventName: "sms-campaigns.provider_configured",
        actorId: locals.user.id,
        entityType: "sms_provider_config",
        entityId: provider.data.id,
        source: "app/sms",
        payload: { vendor: provider.data.vendor, isDefault: provider.data.isDefault, isEnabled: provider.data.isEnabled }
      },
      { auditStore: locals.auditStore }
    );
    return { providerConfigured: true };
  },

  createCampaign: async ({ request, locals, cookies, platform }) => {
    const scoped = await requireManage({ locals, cookies, platform });
    if (!scoped || !locals.user) return fail(403, { error: "Not signed in to a company." });
    const form = await request.formData();
    const vendor = text(form.get("vendor"));
    const sendType = text(form.get("sendType"));
    const values = {
      name: text(form.get("name")),
      vendor,
      sendType,
      templateId: optionalText(form.get("templateId")),
      message: optionalText(form.get("message")),
      scheduledAt: optionalText(form.get("scheduledAt")),
      contactIds: form.getAll("contactIds").map((value) => text(value)).filter(Boolean)
    };
    if (!values.name || !isSmsVendor(vendor) || (sendType !== "immediate" && sendType !== "scheduled")) {
      return fail(400, { error: "Enter a campaign name, provider, and send type.", values });
    }

    const service = createSmsCampaignsService({ store: locals.smsCampaignsStore });
    const campaign = await service.createSmsCampaign(scoped.ctx, {
      name: values.name,
      vendor,
      sendType,
      templateId: values.templateId,
      message: values.message,
      scheduledAt: values.scheduledAt,
      contactIds: values.contactIds
    });
    if (!campaign.ok || !campaign.data) return fail(400, { error: campaign.error?.message ?? "Could not create SMS campaign.", values });

    await recordEvent(
      {
        eventName: "sms-campaigns.campaign_created",
        actorId: locals.user.id,
        entityType: "sms_campaign",
        entityId: campaign.data.campaign.id,
        source: "app/sms",
        payload: {
          status: campaign.data.campaign.status,
          totalContacts: campaign.data.campaign.totalContacts,
          vendor: campaign.data.campaign.vendor
        }
      },
      { auditStore: locals.auditStore }
    );
    return { campaignCreated: true, campaignId: campaign.data.campaign.id };
  },

  dispatchCampaign: async ({ request, locals, cookies, platform }) => {
    const scoped = await requireManage({ locals, cookies, platform });
    if (!scoped || !locals.user) return fail(403, { error: "Not signed in to a company." });
    const form = await request.formData();
    const values = { campaignId: text(form.get("campaignId")) };
    if (!values.campaignId) return fail(400, { error: "Choose a campaign to dispatch.", values });

    const service = createSmsCampaignsService({ store: locals.smsCampaignsStore });
    const dispatched = await service.dispatchSmsCampaign(scoped.ctx, { campaignId: values.campaignId }, previewProvider);
    if (!dispatched.ok || !dispatched.data) return fail(400, { error: dispatched.error?.message ?? "Could not dispatch SMS campaign.", values });

    await recordEvent(
      {
        eventName: "sms-campaigns.campaign_dispatched",
        actorId: locals.user.id,
        entityType: "sms_campaign",
        entityId: dispatched.data.campaign.id,
        source: "app/sms",
        payload: {
          sentCount: dispatched.data.campaign.sentCount,
          failedCount: dispatched.data.campaign.failedCount,
          totalCostCents: dispatched.data.campaign.totalCostCents
        }
      },
      { auditStore: locals.auditStore }
    );
    return { campaignDispatched: true, campaignId: dispatched.data.campaign.id };
  }
};
