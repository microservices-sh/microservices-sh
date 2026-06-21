export type ProductType = "simple" | "combo";

export interface ProductCatalogConfig {
  enabled: boolean;
  defaultCurrency: string;
}

export interface Actor {
  id: string;
  email?: string;
  permissions?: string[];
}

export interface CatalogCategory {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  color: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  tenantId: string;
  sku: string;
  alias: string | null;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  unit: string;
  productType: ProductType;
  active: boolean;
  externalId: string | null;
  externalSource: string | null;
  trackStock: boolean;
  reorderPoint: number;
  reorderQuantity: number;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ComboComponent {
  comboId: string;
  productId: string;
  quantity: number;
}

export interface ProductWithRelations extends Product {
  categoryIds: string[];
  comboComponents: ComboComponent[];
}

export interface ProductFilter {
  tenantId: string;
  search?: string;
  includeInactive?: boolean;
  productType?: ProductType;
  categoryId?: string;
  externalSource?: string;
  limit?: number;
}

export interface CategoryFilter {
  tenantId: string;
  includeInactive?: boolean;
}

export interface CatalogEvent {
  eventName:
    | "product-catalog.category_created"
    | "product-catalog.category_updated"
    | "product-catalog.product_created"
    | "product-catalog.product_updated"
    | "product-catalog.combo_updated";
  entityType: "category" | "product";
  entityId: string;
  tenantId: string;
  payload: Record<string, unknown>;
}

export type ModuleResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: { code: string; message: string; issues?: unknown } };
