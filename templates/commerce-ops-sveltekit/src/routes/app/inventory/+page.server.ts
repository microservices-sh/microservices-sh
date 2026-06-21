import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { recordEvent } from "@microservices-sh/audit-log";
import { listProducts } from "@microservices-sh/product-catalog";
import { listStockMovements, reconcileStock as reconcileInventoryStock, stockIn } from "@microservices-sh/inventory";
import { loadCompanyContext, requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

function text(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function integer(value: string): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function positiveInteger(value: string): number | null {
  const parsed = integer(value);
  return parsed != null && parsed > 0 ? parsed : null;
}

function nonNegativeInteger(value: string): number | null {
  const parsed = integer(value);
  return parsed != null && parsed >= 0 ? parsed : null;
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
    const quantity = positiveInteger(values.quantity);
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
  },
  adjustStock: async ({ request, locals, cookies, platform }) => {
    requireModule("inventory", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    const { permissions } = await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const values = {
      productId: text(form.get("productId")),
      locationId: text(form.get("locationId")) || "default",
      adjustment: text(form.get("adjustment")),
      reference: text(form.get("reference")),
      reason: text(form.get("reason"))
    };
    const adjustment = integer(values.adjustment);
    if (!values.productId || !adjustment) {
      return fail(400, { error: "Choose a product and enter a non-zero adjustment.", values });
    }

    const current = await locals.inventoryStore.getBalance(org.id, values.productId, values.locationId);
    const countedQuantity = current.onHand + adjustment;
    if (countedQuantity < 0) {
      return fail(400, { error: "Adjustment would make on-hand stock negative.", values });
    }

    const result = await reconcileInventoryStock(
      {
        tenantId: org.id,
        productId: values.productId,
        locationId: values.locationId,
        countedQuantity,
        sourceType: "operator-adjustment",
        sourceId: values.reference || `adjustment:${Date.now()}:${values.productId}`,
        reason: values.reason || `Manual stock adjustment ${adjustment > 0 ? "+" : ""}${adjustment}`
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
        eventName: "inventory.stock_reconciled",
        actorId: locals.user.id,
        entityType: "stock_movement",
        entityId: result.data.movement.id,
        source: "app/inventory",
        payload: {
          productId: values.productId,
          locationId: values.locationId,
          adjustment,
          countedQuantity,
          sourceType: "operator-adjustment"
        }
      },
      { auditStore: locals.auditStore }
    );

    return { adjusted: true };
  },
  reconcileStock: async ({ request, locals, cookies, platform }) => {
    requireModule("inventory", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    const { permissions } = await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const values = {
      productId: text(form.get("productId")),
      locationId: text(form.get("locationId")) || "default",
      countedQuantity: text(form.get("countedQuantity")),
      reference: text(form.get("reference")),
      reason: text(form.get("reason"))
    };
    const countedQuantity = nonNegativeInteger(values.countedQuantity);
    if (!values.productId || countedQuantity == null) {
      return fail(400, { error: "Choose a product and enter a zero-or-higher counted quantity.", values });
    }

    const result = await reconcileInventoryStock(
      {
        tenantId: org.id,
        productId: values.productId,
        locationId: values.locationId,
        countedQuantity,
        sourceType: "cycle-count",
        sourceId: values.reference || `count:${Date.now()}:${values.productId}`,
        reason: values.reason || "Physical count reconciliation"
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
        eventName: "inventory.stock_reconciled",
        actorId: locals.user.id,
        entityType: "stock_movement",
        entityId: result.data.movement.id,
        source: "app/inventory",
        payload: {
          productId: values.productId,
          locationId: values.locationId,
          countedQuantity,
          sourceType: "cycle-count"
        }
      },
      { auditStore: locals.auditStore }
    );

    return { reconciled: true };
  }
};
