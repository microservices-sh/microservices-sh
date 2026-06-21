import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { recordEvent } from "@microservices-sh/audit-log";
import { createShipment, listShipments } from "@microservices-sh/shipment";
import { loadCompanyContext, requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

function text(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function positiveNumber(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("shipment", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);
  const shipmentsResult = await listShipments(
    { tenantId: activeOrgId, includeCancelled: true, limit: 100 },
    { shipmentStore: locals.shipmentStore }
  );

  return {
    canManage: permissions.includes("*") || permissions.includes("member.manage"),
    shipments: shipmentsResult.ok ? shipmentsResult.data.shipments : []
  };
};

export const actions: Actions = {
  create: async ({ request, locals, cookies, platform }) => {
    requireModule("shipment", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const values = {
      carrier: text(form.get("carrier")),
      trackingNumber: text(form.get("trackingNumber")),
      sourceId: text(form.get("sourceId")),
      sku: text(form.get("sku")),
      description: text(form.get("description")),
      quantity: text(form.get("quantity")),
      notes: text(form.get("notes"))
    };
    const quantity = positiveNumber(values.quantity);
    if (!values.sourceId || !values.description || !quantity) {
      return fail(400, { error: "Enter a source reference, item description, and positive quantity.", values });
    }

    const result = await createShipment(
      {
        tenantId: org.id,
        carrier: values.carrier || null,
        trackingNumber: values.trackingNumber || null,
        notes: values.notes || null,
        items: [
          {
            sourceType: "manual",
            sourceId: values.sourceId,
            sku: values.sku || null,
            description: values.description,
            quantity
          }
        ]
      },
      {
        shipmentStore: locals.shipmentStore,
        actor: { id: locals.user.id }
      }
    );
    if (!result.ok) return fail(result.status, { error: result.error.message, values });

    await recordEvent(
      {
        eventName: "shipment.created",
        actorId: locals.user.id,
        entityType: "shipment",
        entityId: result.data.shipment.id,
        source: "app/shipments",
        payload: { itemCount: result.data.shipment.items.length, carrier: values.carrier || null }
      },
      { auditStore: locals.auditStore }
    );

    return { created: true };
  }
};
