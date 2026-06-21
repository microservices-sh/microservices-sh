import type { CatalogCategory, ProductWithRelations } from "./types";

export interface ProductCatalogHooks {
  beforeCategoryCreate?: (input: unknown) => Promise<unknown> | unknown;
  beforeProductCreate?: (input: unknown) => Promise<unknown> | unknown;
  afterCategoryUpdated?: (category: CatalogCategory) => Promise<void> | void;
  afterProductUpdated?: (product: ProductWithRelations) => Promise<void> | void;
}

export const defaultProductCatalogHooks: Required<ProductCatalogHooks> = {
  beforeCategoryCreate(input) {
    return input;
  },
  beforeProductCreate(input) {
    return input;
  },
  afterCategoryUpdated() {
    return undefined;
  },
  afterProductUpdated() {
    return undefined;
  }
};
