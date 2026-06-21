import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { recordEvent } from "@microservices-sh/audit-log";
import { listProducts } from "@microservices-sh/product-catalog";
import { listStockMovements, stockIn } from "@microservices-sh/inventory";
import { loadCompanyContext, requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

function text(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function positiveNumber(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function productReader(productCatalogStore: App.Locals["productCatalogStore"]) {
  return {
    async getProduct(tenantId: string, productId: string) {
      const product = await productCatalogStore.getProduct(tenantId, productId);
      return product ? { id: product.id, tenantId: product.tenantId, trackStock: product.trackStock } : null;
    }
  };
}

export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("inventory", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);
  const [productsResult, movementsResult] = await Promise.all([
    listProducts({ tenantId: activeOrgId, includeInactive: true, limit: 250 }, { productCatalogStore: locals.productCatalogStore }),
    listStockMovements({ tenantId: activeOrgId, limit: 100 }, { inventoryStore: locals.inventoryStore })
  ]);
  const products = productsResult.ok ? productsResult.data.products : [];
  const movements = movementsResult.ok ? movementsResult.data.movements : [];
  const balances = await Promise.all(
    products
      .filter((product) => product.trackStock)
      .map(async (product) => ({
        productId: product.id,
        sku: product.sku,
        name: product.name,
        reorderPoint: product.reorderPoint,
        balance: await locals.inventoryStore.getBalance(activeOrgId, product.id, "default")
      }))
  );

  return {
    canManage: permissions.includes("*") || permissions.includes("member.manage"),
    products: products.map((product) => ({
      id: product.id,
      sku: product.sku,
      name: product.name,
      trackStock: product.trackStock
    })),
    balances,
    movements
  };
};

export const actions: Actions = {
  stockIn: async ({ request, locals, cookies, platform }) => {
    requireModule("inventory", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    const { permissions } = await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const values = {
      productId: text(form.get("productId")),
      locationId: text(form.get("locationId")) || "default",
      quantity: text(form.get("quantity")),
      reason: text(form.get("reason"))
    };
    const quantity = positiveNumber(values.quantity);
    if (!values.productId || !quantity) return fail(400, { error: "Choose a product and enter a positive quantity.", values });

    const result = await stockIn(
      {
        tenantId: org.id,
        productId: values.productId,
        locationId: values.locationId,
        quantity,
        sourceType: "operator",
        sourceId: `stock-in:${Date.now()}`,
        reason: values.reason || "Manual stock receipt"
      },
      {
        inventoryStore: locals.inventoryStore,
        productReader: productReader(locals.productCatalogStore),
        actor: { id: locals.user.id, email: locals.user.email, permissions }
      }
    );
    if (!result.ok) return fail(result.status, { error: result.error.message, values });

    await recordEvent(
      {
        eventName: "inventory.stock_received",
        actorId: locals.user.id,
        entityType: "stock_movement",
        entityId: result.data.movement.id,
        source: "app/inventory",
        payload: { productId: values.productId, quantity, locationId: values.locationId }
      },
      { auditStore: locals.auditStore }
    );

    return { stocked: true };
  }
};
