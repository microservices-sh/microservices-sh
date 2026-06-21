import { productInputSchema } from "../schemas";
import { catalogId, isoNow, normalizeOptional, normalizeSku } from "../service";
import type { Actor, ComboComponent, Product } from "../types";
import { enrichProduct, err, hooks, ok, validateComboComponents, type CatalogDeps } from "./shared";

export async function createProduct(input: unknown, deps: CatalogDeps & { actor?: Actor | null }) {
  const filtered = await hooks(deps).beforeProductCreate(input);
  const parsed = productInputSchema.safeParse(filtered);
  if (!parsed.success) {
    return err(400, "product-catalog.INVALID_PRODUCT_INPUT", "Product input is invalid.", parsed.error.issues);
  }

  const sku = normalizeSku(parsed.data.sku);
  const existingSku = await deps.productCatalogStore.findProductBySku(parsed.data.tenantId, sku);
  if (existingSku) {
    return err(409, "product-catalog.SKU_CONFLICT", `A product already uses SKU ${sku}.`);
  }

  const externalId = normalizeOptional(parsed.data.externalId);
  const externalSource = normalizeOptional(parsed.data.externalSource);
  if ((externalId && !externalSource) || (externalSource && !externalId)) {
    return err(400, "product-catalog.INVALID_EXTERNAL_REF", "externalId and externalSource must be supplied together.");
  }
  if (externalId && externalSource) {
    const existingExternal = await deps.productCatalogStore.findProductByExternalRef(
      parsed.data.tenantId,
      externalSource,
      externalId
    );
    if (existingExternal) {
      return err(409, "product-catalog.EXTERNAL_REF_CONFLICT", "A product already uses this external reference.");
    }
  }

  const now = isoNow(deps.now);
  const productId = catalogId("prod");
  const components: ComboComponent[] = parsed.data.comboComponents.map((component) => ({
    comboId: productId,
    productId: component.productId,
    quantity: component.quantity
  }));

  if (parsed.data.productType === "simple" && components.length > 0) {
    return err(409, "product-catalog.SIMPLE_PRODUCT_HAS_COMPONENTS", "Only combo products can have components.");
  }
  const componentValidation = await validateComboComponents(
    deps.productCatalogStore,
    parsed.data.tenantId,
    productId,
    components
  );
  if (componentValidation && !componentValidation.ok) return componentValidation;

  const product: Product = {
    id: productId,
    tenantId: parsed.data.tenantId,
    sku,
    alias: normalizeOptional(parsed.data.alias),
    name: parsed.data.name.trim(),
    description: parsed.data.description ?? null,
    priceCents: parsed.data.priceCents,
    currency: parsed.data.currency.toUpperCase(),
    unit: parsed.data.unit,
    productType: parsed.data.productType,
    active: parsed.data.active,
    externalId,
    externalSource,
    trackStock: parsed.data.trackStock,
    reorderPoint: parsed.data.reorderPoint,
    reorderQuantity: parsed.data.reorderQuantity,
    createdById: deps.actor?.id ?? null,
    createdAt: now,
    updatedAt: now
  };

  await deps.productCatalogStore.insertProduct(product);
  await deps.productCatalogStore.setProductCategoryIds(product.tenantId, product.id, parsed.data.categoryIds);
  await deps.productCatalogStore.setComboComponents(product.tenantId, product.id, components);
  await deps.productCatalogStore.writeEvent({
    eventName: "product-catalog.product_created",
    entityType: "product",
    entityId: product.id,
    tenantId: product.tenantId,
    payload: { actorId: deps.actor?.id ?? null, sku: product.sku, productType: product.productType }
  });

  const enriched = await enrichProduct(deps.productCatalogStore, product);
  await hooks(deps).afterProductUpdated(enriched);

  return ok(201, { product: enriched });
}
