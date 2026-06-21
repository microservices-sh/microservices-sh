export interface ProductCatalogRepository {
  getById(id: string): Promise<unknown | null>;
}
import type {
  CatalogCategory,
  CatalogEvent,
  CategoryFilter,
  ComboComponent,
  Product,
  ProductFilter
} from "../types";

export interface ProductCatalogStore {
  insertCategory(category: CatalogCategory): Promise<void>;
  updateCategory(category: CatalogCategory): Promise<void>;
  getCategory(tenantId: string, categoryId: string): Promise<CatalogCategory | null>;
  listCategories(filter: CategoryFilter): Promise<CatalogCategory[]>;

  insertProduct(product: Product): Promise<void>;
  updateProduct(product: Product): Promise<void>;
  getProduct(tenantId: string, productId: string): Promise<Product | null>;
  findProductBySku(tenantId: string, sku: string): Promise<Product | null>;
  findProductByExternalRef(tenantId: string, externalSource: string, externalId: string): Promise<Product | null>;
  listProducts(filter: ProductFilter): Promise<Product[]>;

  setProductCategoryIds(tenantId: string, productId: string, categoryIds: string[]): Promise<void>;
  listProductCategoryIds(tenantId: string, productId: string): Promise<string[]>;

  setComboComponents(tenantId: string, comboId: string, components: ComboComponent[]): Promise<void>;
  listComboComponents(tenantId: string, comboId: string): Promise<ComboComponent[]>;

  writeEvent(event: CatalogEvent): Promise<void>;
}
