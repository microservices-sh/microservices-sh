import type { ProductCatalogStore } from "../ports";
import type { CatalogCategory, CatalogEvent, ComboComponent, Product, ProductFilter, ProductType } from "../types";
import { catalogId } from "../service";

function rowBool(value: unknown): boolean {
  return Number(value ?? 0) === 1;
}

function rowToCategory(row: Record<string, unknown>): CatalogCategory {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    name: String(row.name),
    description: row.description == null ? null : String(row.description),
    color: String(row.color ?? "#6B7280"),
    active: rowBool(row.active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function rowToProduct(row: Record<string, unknown>): Product {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    sku: String(row.sku),
    alias: row.alias == null ? null : String(row.alias),
    name: String(row.name),
    description: row.description == null ? null : String(row.description),
    priceCents: Number(row.price_cents ?? 0),
    currency: String(row.currency ?? "USD"),
    unit: String(row.unit ?? "unit"),
    productType: String(row.product_type ?? "simple") as ProductType,
    active: rowBool(row.active),
    externalId: row.external_id == null ? null : String(row.external_id),
    externalSource: row.external_source == null ? null : String(row.external_source),
    trackStock: rowBool(row.track_stock),
    reorderPoint: Number(row.reorder_point ?? 0),
    reorderQuantity: Number(row.reorder_quantity ?? 0),
    createdById: row.created_by_id == null ? null : String(row.created_by_id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function rowToComponent(row: Record<string, unknown>): ComboComponent {
  return {
    comboId: String(row.combo_id),
    productId: String(row.product_id),
    quantity: Number(row.quantity ?? 0)
  };
}

const PRODUCT_COLS =
  "id, tenant_id, sku, alias, name, description, price_cents, currency, unit, product_type, active, external_id, external_source, track_stock, reorder_point, reorder_quantity, created_by_id, created_at, updated_at";

export function createD1ProductCatalogStore(db: D1Database): ProductCatalogStore {
  return {
    async insertCategory(category) {
      await db
        .prepare(
          `INSERT INTO catalog_categories (id, tenant_id, name, description, color, active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          category.id,
          category.tenantId,
          category.name,
          category.description,
          category.color,
          category.active ? 1 : 0,
          category.createdAt,
          category.updatedAt
        )
        .run();
    },

    async updateCategory(category) {
      await db
        .prepare(
          `UPDATE catalog_categories SET name = ?, description = ?, color = ?, active = ?, updated_at = ?
           WHERE tenant_id = ? AND id = ?`
        )
        .bind(
          category.name,
          category.description,
          category.color,
          category.active ? 1 : 0,
          category.updatedAt,
          category.tenantId,
          category.id
        )
        .run();
    },

    async getCategory(tenantId, categoryId) {
      const row = await db
        .prepare("SELECT id, tenant_id, name, description, color, active, created_at, updated_at FROM catalog_categories WHERE tenant_id = ? AND id = ?")
        .bind(tenantId, categoryId)
        .first<Record<string, unknown>>();
      return row ? rowToCategory(row) : null;
    },

    async listCategories(filter) {
      const clauses = ["tenant_id = ?"];
      const binds: unknown[] = [filter.tenantId];
      if (!filter.includeInactive) clauses.push("active = 1");
      const result = await db
        .prepare(
          `SELECT id, tenant_id, name, description, color, active, created_at, updated_at
           FROM catalog_categories WHERE ${clauses.join(" AND ")} ORDER BY name ASC`
        )
        .bind(...binds)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToCategory);
    },

    async insertProduct(product) {
      await db
        .prepare(
          `INSERT INTO products (${PRODUCT_COLS})
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          product.id,
          product.tenantId,
          product.sku,
          product.alias,
          product.name,
          product.description,
          product.priceCents,
          product.currency,
          product.unit,
          product.productType,
          product.active ? 1 : 0,
          product.externalId,
          product.externalSource,
          product.trackStock ? 1 : 0,
          product.reorderPoint,
          product.reorderQuantity,
          product.createdById,
          product.createdAt,
          product.updatedAt
        )
        .run();
    },

    async updateProduct(product) {
      await db
        .prepare(
          `UPDATE products SET sku = ?, alias = ?, name = ?, description = ?, price_cents = ?, currency = ?,
             unit = ?, product_type = ?, active = ?, external_id = ?, external_source = ?, track_stock = ?,
             reorder_point = ?, reorder_quantity = ?, updated_at = ?
           WHERE tenant_id = ? AND id = ?`
        )
        .bind(
          product.sku,
          product.alias,
          product.name,
          product.description,
          product.priceCents,
          product.currency,
          product.unit,
          product.productType,
          product.active ? 1 : 0,
          product.externalId,
          product.externalSource,
          product.trackStock ? 1 : 0,
          product.reorderPoint,
          product.reorderQuantity,
          product.updatedAt,
          product.tenantId,
          product.id
        )
        .run();
    },

    async getProduct(tenantId, productId) {
      const row = await db
        .prepare(`SELECT ${PRODUCT_COLS} FROM products WHERE tenant_id = ? AND id = ?`)
        .bind(tenantId, productId)
        .first<Record<string, unknown>>();
      return row ? rowToProduct(row) : null;
    },

    async findProductBySku(tenantId, sku) {
      const row = await db
        .prepare(`SELECT ${PRODUCT_COLS} FROM products WHERE tenant_id = ? AND sku = ?`)
        .bind(tenantId, sku)
        .first<Record<string, unknown>>();
      return row ? rowToProduct(row) : null;
    },

    async findProductByExternalRef(tenantId, externalSource, externalId) {
      const row = await db
        .prepare(`SELECT ${PRODUCT_COLS} FROM products WHERE tenant_id = ? AND external_source = ? AND external_id = ?`)
        .bind(tenantId, externalSource, externalId)
        .first<Record<string, unknown>>();
      return row ? rowToProduct(row) : null;
    },

    async listProducts(filter) {
      const clauses = ["tenant_id = ?"];
      const binds: unknown[] = [filter.tenantId];
      if (!filter.includeInactive) clauses.push("active = 1");
      if (filter.productType) {
        clauses.push("product_type = ?");
        binds.push(filter.productType);
      }
      if (filter.externalSource) {
        clauses.push("external_source = ?");
        binds.push(filter.externalSource);
      }
      if (filter.search) {
        const search = `%${filter.search.toLowerCase()}%`;
        clauses.push("(LOWER(sku) LIKE ? OR LOWER(name) LIKE ? OR LOWER(COALESCE(alias, '')) LIKE ?)");
        binds.push(search, search, search);
      }
      if (filter.categoryId) {
        clauses.push(
          `id IN (
            SELECT product_id FROM product_category_assignments
            WHERE tenant_id = ? AND category_id = ?
          )`
        );
        binds.push(filter.tenantId, filter.categoryId);
      }
      const result = await db
        .prepare(`SELECT ${PRODUCT_COLS} FROM products WHERE ${clauses.join(" AND ")} ORDER BY sku ASC LIMIT ?`)
        .bind(...binds, filter.limit ?? 100)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToProduct);
    },

    async setProductCategoryIds(tenantId, productId, categoryIds) {
      await db
        .prepare("DELETE FROM product_category_assignments WHERE tenant_id = ? AND product_id = ?")
        .bind(tenantId, productId)
        .run();
      for (const categoryId of [...new Set(categoryIds)]) {
        await db
          .prepare("INSERT INTO product_category_assignments (id, tenant_id, product_id, category_id) VALUES (?, ?, ?, ?)")
          .bind(catalogId("pca"), tenantId, productId, categoryId)
          .run();
      }
    },

    async listProductCategoryIds(tenantId, productId) {
      const result = await db
        .prepare("SELECT category_id FROM product_category_assignments WHERE tenant_id = ? AND product_id = ? ORDER BY category_id ASC")
        .bind(tenantId, productId)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map((row) => String(row.category_id));
    },

    async setComboComponents(tenantId, comboId, components) {
      await db.prepare("DELETE FROM combo_products WHERE tenant_id = ? AND combo_id = ?").bind(tenantId, comboId).run();
      for (const component of components) {
        await db
          .prepare("INSERT INTO combo_products (id, tenant_id, combo_id, product_id, quantity) VALUES (?, ?, ?, ?, ?)")
          .bind(catalogId("combo"), tenantId, comboId, component.productId, component.quantity)
          .run();
      }
    },

    async listComboComponents(tenantId, comboId) {
      const result = await db
        .prepare("SELECT combo_id, product_id, quantity FROM combo_products WHERE tenant_id = ? AND combo_id = ? ORDER BY rowid ASC")
        .bind(tenantId, comboId)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(rowToComponent);
    },

    async writeEvent(event) {
      await db
        .prepare(
          "INSERT INTO domain_events (id, event_name, entity_type, entity_id, payload, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)"
        )
        .bind(catalogId("evt"), event.eventName, event.entityType, event.entityId, JSON.stringify(event))
        .run();
    }
  };
}
