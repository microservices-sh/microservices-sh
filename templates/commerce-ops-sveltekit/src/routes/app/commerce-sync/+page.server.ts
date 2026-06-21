import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { recordEvent } from "@microservices-sh/audit-log";
import { getCommerceSyncModuleStatus, verifyWooCommerceWebhookSignature } from "@microservices-sh/commerce-sync";
import type { CommerceProvider, CommerceResourceType } from "@microservices-sh/commerce-sync";
import { loadCompanyContext, requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

const PROVIDERS = new Set<CommerceProvider>(["woocommerce", "shopify", "custom"]);
const RESOURCE_TYPES = new Set<CommerceResourceType>(["customer", "product", "order", "category", "inventory"]);

function text(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function provider(value: string): CommerceProvider | null {
  return PROVIDERS.has(value as CommerceProvider) ? (value as CommerceProvider) : null;
}

function resourceType(value: string): CommerceResourceType | null {
  return RESOURCE_TYPES.has(value as CommerceResourceType) ? (value as CommerceResourceType) : null;
}

function nonNegativeInteger(value: string): number | null {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
}

function parseJsonPayload(value: string): unknown {
  if (!value) return {};
  return JSON.parse(value);
}

function webhookSecret(value: FormDataEntryValue | null, platform: App.Platform | undefined): string {
  return text(value) || platform?.env?.WOOCOMMERCE_WEBHOOK_SECRET?.trim() || "";
}

export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("commerce-sync", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");
  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);

  const service = locals.commerceSyncService;
  const ctx = { tenantId: activeOrgId };
  const [connections, runs, mappings, receipts] = await Promise.all([
    service.listCommerceConnections(ctx),
    service.listSyncRuns(ctx),
    service.listProviderMappings(ctx),
    service.listWebhookReceipts(ctx)
  ]);

  return {
    canManage: permissions.includes("*") || permissions.includes("member.manage"),
    status: getCommerceSyncModuleStatus(),
    connections: connections.ok ? connections.data : [],
    run: runs.ok ? (runs.data[0] ?? null) : null,
    mapping: mappings.ok ? (mappings.data[0] ?? null) : null,
    webhook: receipts.ok ? (receipts.data[0] ?? null) : null
  };
};

export const actions: Actions = {
  createConnection: async ({ request, locals, cookies, platform }) => {
    requireModule("commerce-sync", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const values = {
      provider: text(form.get("provider")),
      name: text(form.get("name")),
      baseUrl: text(form.get("baseUrl")),
      secretRef: text(form.get("secretRef"))
    };
    const selectedProvider = provider(values.provider);
    if (!selectedProvider || !values.name || !values.secretRef) {
      return fail(400, { error: "Choose a provider and enter a connection name plus secret reference.", values });
    }

    const result = await locals.commerceSyncService.createCommerceConnection(
      { tenantId: org.id, actorId: locals.user.id },
      {
        provider: selectedProvider,
        name: values.name,
        baseUrl: values.baseUrl || undefined,
        secretRef: values.secretRef
      }
    );
    if (!result.ok || !result.data) return fail(400, { error: result.error?.message ?? "Could not create connection.", values });

    await recordEvent(
      {
        eventName: "commerce-sync.connection_created",
        actorId: locals.user.id,
        entityType: "commerce_connection",
        entityId: result.data.id,
        source: "app/commerce-sync",
        payload: { provider: result.data.provider, name: result.data.name }
      },
      { auditStore: locals.auditStore }
    );

    return { connectionCreated: true };
  },

  recordManualRun: async ({ request, locals, cookies, platform }) => {
    requireModule("commerce-sync", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const values = {
      connectionId: text(form.get("connectionId")),
      resourceType: text(form.get("resourceType")),
      processedCount: text(form.get("processedCount")),
      createdCount: text(form.get("createdCount")),
      updatedCount: text(form.get("updatedCount")),
      failedCount: text(form.get("failedCount"))
    };
    const selectedResource = resourceType(values.resourceType);
    const processedCount = nonNegativeInteger(values.processedCount);
    const createdCount = nonNegativeInteger(values.createdCount);
    const updatedCount = nonNegativeInteger(values.updatedCount);
    const failedCount = nonNegativeInteger(values.failedCount);
    if (!values.connectionId || !selectedResource || processedCount == null || createdCount == null || updatedCount == null || failedCount == null) {
      return fail(400, { error: "Choose a connection and enter non-negative run counters.", values });
    }

    const ctx = { tenantId: org.id, actorId: locals.user.id };
    const started = await locals.commerceSyncService.startSyncRun(ctx, values.connectionId, selectedResource);
    if (!started.ok || !started.data) return fail(400, { error: started.error?.message ?? "Could not start sync run.", values });
    const completed = await locals.commerceSyncService.completeSyncRun(ctx, started.data.id, {
      processedCount,
      createdCount,
      updatedCount,
      failedCount
    });
    if (!completed.ok || !completed.data) return fail(400, { error: completed.error?.message ?? "Could not complete sync run.", values });

    await recordEvent(
      {
        eventName: "commerce-sync.sync_completed",
        actorId: locals.user.id,
        entityType: "commerce_sync_run",
        entityId: completed.data.id,
        source: "app/commerce-sync",
        payload: { resourceType: selectedResource, processedCount, createdCount, updatedCount, failedCount }
      },
      { auditStore: locals.auditStore }
    );

    return { runRecorded: true };
  },

  recordWebhook: async ({ request, locals, cookies, platform }) => {
    requireModule("commerce-sync", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const values = {
      connectionId: text(form.get("connectionId")),
      topic: text(form.get("topic")),
      idempotencyKey: text(form.get("idempotencyKey")),
      signature: text(form.get("signature")),
      payload: text(form.get("payload"))
    };
    const secret = webhookSecret(form.get("webhookSecret"), platform);
    let payload: unknown;
    try {
      payload = parseJsonPayload(values.payload);
    } catch {
      return fail(400, { error: "Webhook payload must be valid JSON.", values });
    }
    if (!values.connectionId || !values.topic || !values.idempotencyKey) {
      return fail(400, { error: "Choose a connection and enter webhook topic plus idempotency key.", values });
    }
    const ctx = { tenantId: org.id, actorId: locals.user.id };
    const connections = await locals.commerceSyncService.listCommerceConnections(ctx);
    const connection = connections.ok ? connections.data?.find((item) => item.id === values.connectionId) : null;
    if (!connection) return fail(400, { error: "Commerce connection not found.", values });

    let signatureVerified = false;
    if (connection.provider === "woocommerce" && values.signature) {
      if (!secret) {
        return fail(400, { error: "Enter a WooCommerce webhook secret or configure WOOCOMMERCE_WEBHOOK_SECRET.", values });
      }
      signatureVerified = await verifyWooCommerceWebhookSignature(values.payload, values.signature, secret);
      if (!signatureVerified) return fail(400, { error: "WooCommerce webhook signature verification failed.", values });
    }

    const receipt = await locals.commerceSyncService.recordWebhookReceipt(
      ctx,
      {
        connectionId: values.connectionId,
        topic: values.topic,
        idempotencyKey: values.idempotencyKey,
        signature: values.signature || undefined,
        payload
      }
    );
    if (!receipt.ok || !receipt.data) return fail(400, { error: receipt.error?.message ?? "Could not record webhook receipt.", values });

    await recordEvent(
      {
        eventName: "commerce-sync.webhook_recorded",
        actorId: locals.user.id,
        entityType: "commerce_webhook_receipt",
        entityId: receipt.data.id,
        source: "app/commerce-sync",
        payload: { topic: receipt.data.topic, replayed: receipt.data.replayed, signatureVerified }
      },
      { auditStore: locals.auditStore }
    );

    return { webhookRecorded: true };
  }
};
