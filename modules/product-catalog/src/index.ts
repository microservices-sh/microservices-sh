export { manifest } from "./manifest";
export {
  categoryFilterSchema,
  categoryInputSchema,
  categoryUpdateSchema,
  productCatalogConfigSchema,
  productFilterSchema,
  productInputSchema,
  productRecordSchema,
  productUpdateSchema,
  setComboComponentsSchema
} from "./schemas";
export { defaultProductCatalogHooks } from "./hooks";
export { productCatalogEvents } from "./events";
export { productCatalogPermissions } from "./permissions";
export { productCatalogResources } from "./resources";
export { createMemoryProductCatalogStore } from "./adapters/memory-product-catalog-store";
export { createD1ProductCatalogStore } from "./adapters/d1-product-catalog-store";
export { createCategory } from "./use-cases/create-category";
export { createProduct } from "./use-cases/create-product";
export { expandProductComponents } from "./use-cases/expand-product-components";
export { getProduct } from "./use-cases/get-product";
export { listCategories } from "./use-cases/list-categories";
export { listProducts } from "./use-cases/list-products";
export { updateProduct } from "./use-cases/update-product";
export type { ProductCatalogStore } from "./ports";
export type {
  Actor,
  CatalogCategory,
  CatalogEvent,
  CategoryFilter,
  ComboComponent,
  ModuleResult,
  Product,
  ProductCatalogConfig,
  ProductFilter,
  ProductType,
  ProductWithRelations
} from "./types";

export const productCatalogModule = {
  id: "product-catalog",
  version: "0.1.0"
} as const;
