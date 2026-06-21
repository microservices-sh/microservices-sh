import type { ProductCatalogStore } from "../ports";
import type { CatalogCategory, CatalogEvent, ComboComponent, Product, ProductFilter } from "../types";

function cloneProduct(product: Product): Product {
  return { ...product };
}

function cloneCategory(category: CatalogCategory): CatalogCategory {
  return { ...category };
}

function cloneComponent(component: ComboComponent): ComboComponent {
  return { ...component };
}

function matchesSearch(product: Product, search?: string): boolean {
  if (!search) return true;
  const needle = search.toLowerCase();
  return (
    product.sku.toLowerCase().includes(needle) ||
    product.name.toLowerCase().includes(needle) ||
    (product.alias ?? "").toLowerCase().includes(needle)
  );
}

function productVisible(product: Product, filter: ProductFilter, categoryIds: string[]): boolean {
  return (
    product.tenantId === filter.tenantId &&
    (filter.includeInactive || product.active) &&
    (!filter.productType || product.productType === filter.productType) &&
    (!filter.externalSource || product.externalSource === filter.externalSource) &&
    (!filter.categoryId || categoryIds.includes(filter.categoryId)) &&
    matchesSearch(product, filter.search)
  );
}

export function createMemoryProductCatalogStore(): ProductCatalogStore {
  const categories = new Map<string, CatalogCategory>();
  const products = new Map<string, Product>();
  const productCategories = new Map<string, Set<string>>();
  const comboComponents = new Map<string, ComboComponent[]>();
  const events: CatalogEvent[] = [];

  return {
    async insertCategory(category) {
      categories.set(category.id, cloneCategory(category));
    },

    async updateCategory(category) {
      categories.set(category.id, cloneCategory(category));
    },

    async getCategory(tenantId, categoryId) {
      const category = categories.get(categoryId);
      return category && category.tenantId === tenantId ? cloneCategory(category) : null;
    },

    async listCategories(filter) {
      return [...categories.values()]
        .filter((category) => category.tenantId === filter.tenantId && (filter.includeInactive || category.active))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(cloneCategory);
    },

    async insertProduct(product) {
      products.set(product.id, cloneProduct(product));
    },

    async updateProduct(product) {
      products.set(product.id, cloneProduct(product));
    },

    async getProduct(tenantId, productId) {
      const product = products.get(productId);
      return product && product.tenantId === tenantId ? cloneProduct(product) : null;
    },

    async findProductBySku(tenantId, sku) {
      const found = [...products.values()].find((product) => product.tenantId === tenantId && product.sku === sku);
      return found ? cloneProduct(found) : null;
    },

    async findProductByExternalRef(tenantId, externalSource, externalId) {
      const found = [...products.values()].find(
        (product) =>
          product.tenantId === tenantId &&
          product.externalSource === externalSource &&
          product.externalId === externalId
      );
      return found ? cloneProduct(found) : null;
    },

    async listProducts(filter) {
      return [...products.values()]
        .filter((product) => productVisible(product, filter, [...(productCategories.get(product.id) ?? [])]))
        .sort((a, b) => a.sku.localeCompare(b.sku))
        .slice(0, filter.limit ?? 100)
        .map(cloneProduct);
    },

    async setProductCategoryIds(_tenantId, productId, categoryIds) {
      productCategories.set(productId, new Set(categoryIds));
    },

    async listProductCategoryIds(_tenantId, productId) {
      return [...(productCategories.get(productId) ?? [])];
    },

    async setComboComponents(_tenantId, comboId, components) {
      comboComponents.set(comboId, components.map(cloneComponent));
    },

    async listComboComponents(_tenantId, comboId) {
      return (comboComponents.get(comboId) ?? []).map(cloneComponent);
    },

    async writeEvent(event) {
      events.push({ ...event, payload: { ...event.payload } });
    }
  };
}
