import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import {
  createMemoryHttpClient,
  deliverEvent,
  listDeliveries,
  listEndpoints
} from "@microservices-sh/webhook-delivery";
import { recordEvent } from "@microservices-sh/audit-log";
import { loadCompanyContext, requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

function parseObjectPayload(raw: FormDataEntryValue | null): Record<string, unknown> {
  const text = String(raw ?? "").trim();
  if (!text) return {};
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Payload must be a JSON object.");
  }
  return parsed as Record<string, unknown>;
}

// Reference UI for @microservices-sh/webhook-delivery: delivery log and a safe
// local test-delivery action. Endpoint registration lives in the Settings hub
// (/app/settings/webhooks); listEndpoints is still loaded here to populate the
// test-delivery target context.
export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("webhook-delivery", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);

  const [endpointsResult, deliveriesResult] = await Promise.all([
    listEndpoints({ endpointStore: locals.webhookEndpointStore }),
    listDeliveries({ limit: 100 }, { deliveryLog: locals.webhookDeliveryLog })
  ]);

  return {
    canManage: permissions.includes("*") || permissions.includes("member.manage"),
    endpoints: endpointsResult.ok ? endpointsResult.data.endpoints : [],
    deliveries: deliveriesResult.ok ? deliveriesResult.data.deliveries : []
  };
};

export const actions: Actions = {
  deliverDemo: async ({ request, locals, cookies, platform }) => {
    requireModule("webhook-delivery", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const eventName = String(form.get("eventName") ?? "").trim();
    const entityType = String(form.get("entityType") ?? "").trim();
    const entityId = String(form.get("entityId") ?? "").trim();
    if (!eventName || !entityType || !entityId) {
      return fail(400, { error: "Event name, entity type, and entity id are required." });
    }

    let payload: Record<string, unknown>;
    try {
      payload = parseObjectPayload(form.get("payload"));
    } catch (caught) {
      return fail(400, { error: caught instanceof Error ? caught.message : "Payload is invalid." });
    }

    const httpClient = createMemoryHttpClient(() => ({ status: 202, ok: true }));
    const result = await deliverEvent(
      { eventName, entityType, entityId, payload },
      {
        endpointStore: locals.webhookEndpointStore,
        deliveryLog: locals.webhookDeliveryLog,
        httpClient
      }
    );
    if (!result.ok) return fail(result.status ?? 400, { error: result.error?.message ?? "Could not deliver the event." });

    await recordEvent(
      {
        eventName: "webhook-delivery.demo_delivered",
        actorId: locals.user.id,
        entityType,
        entityId,
        source: "app/webhooks",
        payload: { eventName, matched: result.data.matched, delivered: result.data.delivered, failed: result.data.failed }
      },
      { auditStore: locals.auditStore }
    );
    return {
      ok: true,
      delivered: true,
      matched: result.data.matched,
      deliveredCount: result.data.delivered,
      failedCount: result.data.failed
    };
  }
};
