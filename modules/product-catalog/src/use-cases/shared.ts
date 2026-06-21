import { defaultProductCatalogHooks, type ProductCatalogHooks } from "../hooks";
import type { ProductCatalogStore } from "../ports";
import type { ComboComponent, ModuleResult, Product, ProductWithRelations } from "../types";

export interface CatalogDeps {
  productCatalogStore: ProductCatalogStore;
  hooks?: ProductCatalogHooks;
  now?: () => number;
}

export function err<T = never>(status: number, code: string, message: string, issues?: unknown): ModuleResult<T> {
  return { ok: false, status, error: { code, message, issues } };
}

export function ok<T>(status: number, data: T): ModuleResult<T> {
  return { ok: true, status, data };
}

export function hooks(deps: CatalogDeps): Required<ProductCatalogHooks> {
  return { ...defaultProductCatalogHooks, ...(deps.hooks ?? {}) };
}

export async function enrichProduct(store: ProductCatalogStore, product: Product): Promise<ProductWithRelations> {
  const [categoryIds, comboComponents] = await Promise.all([
    store.listProductCategoryIds(product.tenantId, product.id),
    store.listComboComponents(product.tenantId, product.id)
  ]);
  return { ...product, categoryIds, comboComponents };
}

export async function validateComboComponents(
  store: ProductCatalogStore,
  tenantId: string,
  comboId: string,
  components: ComboComponent[]
): Promise<ModuleResult<{ components: ComboComponent[] }> | null> {
  const seen = new Set<string>();
  const normalized: ComboComponent[] = [];

  for (const component of components) {
    if (component.productId === comboId) {
      return err(409, "product-catalog.COMBO_SELF_REFERENCE", "A combo product cannot include itself.");
    }
    if (seen.has(component.productId)) {
      return err(409, "product-catalog.DUPLICATE_COMBO_COMPONENT", "Combo components must be unique per product.");
    }
    const product = await store.getProduct(tenantId, component.productId);
    if (!product) {
      return err(404, "product-catalog.COMPONENT_NOT_FOUND", `Component product not found: ${component.productId}`);
    }
    seen.add(component.productId);
    normalized.push({ comboId, productId: component.productId, quantity: component.quantity });
  }

  return ok(200, { components: normalized });
}
