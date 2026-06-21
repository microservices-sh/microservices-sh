import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { recordEvent } from "@microservices-sh/audit-log";
import { listProducts } from "@microservices-sh/product-catalog";
import { createDraftOrder, listOrders } from "@microservices-sh/sales-order";
import { loadCompanyContext, requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

function text(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function cents(value: string): number | null {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null;
}

function positiveInteger(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("sales-order", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);
  const [ordersResult, productsResult] = await Promise.all([
    listOrders({ tenantId: activeOrgId, limit: 100 }, { salesOrderStore: locals.salesOrderStore }),
    listProducts({ tenantId: activeOrgId, includeInactive: false, limit: 250 }, { productCatalogStore: locals.productCatalogStore })
  ]);

  return {
    canManage: permissions.includes("*") || permissions.includes("member.manage"),
    orders: ordersResult.ok ? ordersResult.data.orders : [],
    products: productsResult.ok
      ? productsResult.data.products.map((product) => ({
          id: product.id,
          sku: product.sku,
          name: product.name,
          priceCents: product.priceCents,
          currency: product.currency
        }))
      : []
  };
};

export const actions: Actions = {
  create: async ({ request, locals, cookies, platform }) => {
    requireModule("sales-order", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    const { permissions } = await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const values = {
      customerName: text(form.get("customerName")),
      customerEmail: text(form.get("customerEmail")),
      productId: text(form.get("productId")),
      sku: text(form.get("sku")),
      itemName: text(form.get("itemName")),
      quantity: text(form.get("quantity")),
      unitPrice: text(form.get("unitPrice")),
      currency: text(form.get("currency")).toUpperCase() || "USD",
      notes: text(form.get("notes"))
    };
    const quantity = positiveInteger(values.quantity);
    const unitPriceCents = cents(values.unitPrice);
    if (!values.itemName || !quantity || unitPriceCents == null) {
      return fail(400, { error: "Enter an item name, positive quantity, and non-negative price.", values });
    }

    const result = await createDraftOrder(
      {
        tenantId: org.id,
        customerSnapshot: values.customerName
          ? {
              displayName: values.customerName,
              email: values.customerEmail || null
            }
          : null,
        currency: values.currency,
        notes: values.notes || null,
        lineItems: [
          {
            productId: values.productId || null,
            sku: values.sku || null,
            name: values.itemName,
            quantity,
            unitPriceCents
          }
        ]
      },
      {
        salesOrderStore: locals.salesOrderStore,
        actor: { id: locals.user.id, email: locals.user.email, permissions }
      }
    );
    if (!result.ok) return fail(result.status, { error: result.error.message, values });

    await recordEvent(
      {
        eventName: "sales-order.order_created",
        actorId: locals.user.id,
        entityType: "sales-order",
        entityId: result.data.order.id,
        source: "app/sales-orders",
        payload: { totalCents: result.data.order.totalCents, status: result.data.order.status }
      },
      { auditStore: locals.auditStore }
    );

    return { created: true };
  }
};
