import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { createProduct, listProducts } from "@microservices-sh/product-catalog";
import { recordEvent } from "@microservices-sh/audit-log";
import { loadCompanyContext, requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

function text(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function moneyToCents(value: string): number | null {
  if (!value) return 0;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

function nonNegativeNumber(value: string): number | null {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("product-catalog", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);
  const result = await listProducts(
    { tenantId: activeOrgId, includeInactive: true, limit: 250 },
    { productCatalogStore: locals.productCatalogStore }
  );

  return {
    canManage: permissions.includes("*") || permissions.includes("member.manage"),
    products: result.ok
      ? result.data.products.map((product) => ({
          id: product.id,
          sku: product.sku,
          name: product.name,
          description: product.description,
          priceCents: product.priceCents,
          currency: product.currency,
          unit: product.unit,
          productType: product.productType,
          active: product.active,
          trackStock: product.trackStock,
          reorderPoint: product.reorderPoint,
          reorderQuantity: product.reorderQuantity
        }))
      : []
  };
};

export const actions: Actions = {
  create: async ({ request, locals, cookies, platform }) => {
    requireModule("product-catalog", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });

    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    const { permissions } = await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const values = {
      sku: text(form.get("sku")).toUpperCase(),
      name: text(form.get("name")),
      description: text(form.get("description")),
      price: text(form.get("price")),
      currency: text(form.get("currency")).toUpperCase() || "USD",
      unit: text(form.get("unit")) || "unit",
      trackStock: form.get("trackStock") === "on",
      reorderPoint: text(form.get("reorderPoint")),
      reorderQuantity: text(form.get("reorderQuantity"))
    };

    if (!values.sku || !values.name) {
      return fail(400, { error: "Enter a SKU and product name.", values });
    }

    const priceCents = moneyToCents(values.price);
    const reorderPoint = nonNegativeNumber(values.reorderPoint);
    const reorderQuantity = nonNegativeNumber(values.reorderQuantity);
    if (priceCents == null || reorderPoint == null || reorderQuantity == null) {
      return fail(400, { error: "Use non-negative numbers for price and reorder fields.", values });
    }

    const result = await createProduct(
      {
        tenantId: org.id,
        sku: values.sku,
        name: values.name,
        description: values.description || null,
        priceCents,
        currency: values.currency,
        unit: values.unit,
        productType: "simple",
        trackStock: values.trackStock,
        reorderPoint,
        reorderQuantity
      },
      {
        productCatalogStore: locals.productCatalogStore,
        actor: { id: locals.user.id, email: locals.user.email, permissions }
      }
    );

    if (!result.ok) {
      return fail(result.status, {
        error: result.error.message,
        values
      });
    }

    await recordEvent(
      {
        eventName: "product-catalog.product_created",
        actorId: locals.user.id,
        entityType: "product",
        entityId: result.data.product.id,
        source: "app/products",
        payload: { sku: result.data.product.sku, name: result.data.product.name }
      },
      { auditStore: locals.auditStore }
    );

    return { created: true };
  }
};
