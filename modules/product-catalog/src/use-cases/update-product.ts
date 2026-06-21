import { productUpdateSchema } from "../schemas";
import { isoNow, normalizeOptional, normalizeSku } from "../service";
import type { Actor, ComboComponent, Product } from "../types";
import { enrichProduct, err, hooks, ok, validateComboComponents, type CatalogDeps } from "./shared";

export async function updateProduct(input: unknown, deps: CatalogDeps & { actor?: Actor | null }) {
  const parsed = productUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "product-catalog.INVALID_PRODUCT_UPDATE", "Product update is invalid.", parsed.error.issues);
  }

  const existing = await deps.productCatalogStore.getProduct(parsed.data.tenantId, parsed.data.productId);
  if (!existing) return err(404, "product-catalog.PRODUCT_NOT_FOUND", "Product not found.");

  const sku = parsed.data.sku ? normalizeSku(parsed.data.sku) : existing.sku;
  if (sku !== existing.sku) {
    const duplicate = await deps.productCatalogStore.findProductBySku(existing.tenantId, sku);
    if (duplicate && duplicate.id !== existing.id) {
      return err(409, "product-catalog.SKU_CONFLICT", `A product already uses SKU ${sku}.`);
    }
  }

  const externalId = parsed.data.externalId !== undefined ? normalizeOptional(parsed.data.externalId) : existing.externalId;
  const externalSource =
    parsed.data.externalSource !== undefined ? normalizeOptional(parsed.data.externalSource) : existing.externalSource;
  if ((externalId && !externalSource) || (externalSource && !externalId)) {
    return err(400, "product-catalog.INVALID_EXTERNAL_REF", "externalId and externalSource must be supplied together.");
  }
  if (externalId && externalSource && (externalId !== existing.externalId || externalSource !== existing.externalSource)) {
    const duplicate = await deps.productCatalogStore.findProductByExternalRef(existing.tenantId, externalSource, externalId);
    if (duplicate && duplicate.id !== existing.id) {
      return err(409, "product-catalog.EXTERNAL_REF_CONFLICT", "A product already uses this external reference.");
    }
  }

  const product: Product = {
    ...existing,
    sku,
    alias: parsed.data.alias !== undefined ? normalizeOptional(parsed.data.alias) : existing.alias,
    name: parsed.data.name !== undefined ? parsed.data.name.trim() : existing.name,
    description: parsed.data.description !== undefined ? parsed.data.description ?? null : existing.description,
    priceCents: parsed.data.priceCents ?? existing.priceCents,
    currency: parsed.data.currency !== undefined ? parsed.data.currency.toUpperCase() : existing.currency,
    unit: parsed.data.unit ?? existing.unit,
    productType: parsed.data.productType ?? existing.productType,
    active: parsed.data.active ?? existing.active,
    externalId,
    externalSource,
    trackStock: parsed.data.trackStock ?? existing.trackStock,
    reorderPoint: parsed.data.reorderPoint ?? existing.reorderPoint,
    reorderQuantity: parsed.data.reorderQuantity ?? existing.reorderQuantity,
    updatedAt: isoNow(deps.now)
  };

  const components: ComboComponent[] | null =
    parsed.data.comboComponents === undefined
      ? null
      : parsed.data.comboComponents.map((component) => ({
          comboId: product.id,
          productId: component.productId,
          quantity: component.quantity
        }));
  if (product.productType === "simple" && components && components.length > 0) {
    return err(409, "product-catalog.SIMPLE_PRODUCT_HAS_COMPONENTS", "Only combo products can have components.");
  }
  if (components) {
    const componentValidation = await validateComboComponents(deps.productCatalogStore, product.tenantId, product.id, components);
    if (componentValidation && !componentValidation.ok) return componentValidation;
  }

  await deps.productCatalogStore.updateProduct(product);
  if (parsed.data.categoryIds !== undefined) {
    await deps.productCatalogStore.setProductCategoryIds(product.tenantId, product.id, parsed.data.categoryIds);
  }
  if (components) {
    await deps.productCatalogStore.setComboComponents(product.tenantId, product.id, components);
    await deps.productCatalogStore.writeEvent({
      eventName: "product-catalog.combo_updated",
      entityType: "product",
      entityId: product.id,
      tenantId: product.tenantId,
      payload: { actorId: deps.actor?.id ?? null, componentCount: components.length }
    });
  }
  await deps.productCatalogStore.writeEvent({
    eventName: "product-catalog.product_updated",
    entityType: "product",
    entityId: product.id,
    tenantId: product.tenantId,
    payload: { actorId: deps.actor?.id ?? null, sku: product.sku }
  });

  const enriched = await enrichProduct(deps.productCatalogStore, product);
  await hooks(deps).afterProductUpdated(enriched);
  return ok(200, { product: enriched });
}
