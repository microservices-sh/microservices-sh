import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { listEndpoints, registerEndpoint } from "@microservices-sh/webhook-delivery";
import { recordEvent } from "@microservices-sh/audit-log";
import { loadCompanyContext, requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

function eventNames(raw: FormDataEntryValue | null): string[] {
  return String(raw ?? "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

// Settings hub: endpoint registration (configuration) for
// @microservices-sh/webhook-delivery. Operational delivery review stays on
// /app/webhooks.
export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("webhook-delivery", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);

  const endpointsResult = await listEndpoints({ endpointStore: locals.webhookEndpointStore });

  return {
    canManage: permissions.includes("*") || permissions.includes("member.manage"),
    endpoints: endpointsResult.ok ? endpointsResult.data.endpoints : []
  };
};

export const actions: Actions = {
  register: async ({ request, locals, cookies, platform }) => {
    requireModule("webhook-delivery", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const url = String(form.get("url") ?? "").trim();
    if (!url) return fail(400, { error: "Enter an endpoint URL." });

    const result = await registerEndpoint(
      { url, eventNames: eventNames(form.get("eventNames")) },
      { endpointStore: locals.webhookEndpointStore }
    );
    if (!result.ok) return fail(result.status ?? 400, { error: result.error?.message ?? "Could not register the endpoint." });

    await recordEvent(
      {
        eventName: "webhook-delivery.endpoint_registered",
        actorId: locals.user.id,
        entityType: "webhook_endpoint",
        entityId: result.data.id,
        source: "app/webhooks",
        payload: { url, eventNames: result.data.eventNames }
      },
      { auditStore: locals.auditStore }
    );
    return { ok: true, registered: true, secret: result.data.secret };
  }
};
