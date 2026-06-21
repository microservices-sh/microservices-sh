import { describe, expect, it } from "vitest";
import {
  createCategory,
  createMemoryProductCatalogStore,
  createProduct,
  expandProductComponents,
  listProducts,
  updateProduct
} from "./index";

const T0 = Date.parse("2026-01-01T00:00:00.000Z");
const fixedNow = (ms: number) => () => ms;

async function createSimple(store: ReturnType<typeof createMemoryProductCatalogStore>, sku: string, quantity = 1) {
  const result = await createProduct(
    {
      tenantId: "tenant-1",
      sku,
      name: `Product ${sku}`,
      priceCents: 1000 * quantity,
      trackStock: true
    },
    { productCatalogStore: store, now: fixedNow(T0) }
  );
  if (!result.ok) throw new Error(result.error.message);
  return result.data.product;
}

describe("product-catalog: products", () => {
  it("normalizes and enforces SKU uniqueness per tenant", async () => {
    const store = createMemoryProductCatalogStore();
    const first = await createSimple(store, " abc-1 ");
    expect(first.sku).toBe("ABC-1");

    const duplicate = await createProduct(
      { tenantId: "tenant-1", sku: "abc-1", name: "Duplicate" },
      { productCatalogStore: store, now: fixedNow(T0 + 1) }
    );
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) expect(duplicate.error.code).toBe("product-catalog.SKU_CONFLICT");

    const otherTenant = await createProduct(
      { tenantId: "tenant-2", sku: "abc-1", name: "Allowed" },
      { productCatalogStore: store, now: fixedNow(T0 + 2) }
    );
    expect(otherTenant.ok).toBe(true);
  });

  it("enforces external references per tenant", async () => {
    const store = createMemoryProductCatalogStore();
    await createProduct(
      { tenantId: "tenant-1", sku: "EXT-1", name: "Imported", externalSource: "woocommerce", externalId: "42" },
      { productCatalogStore: store, now: fixedNow(T0) }
    );

    const duplicate = await createProduct(
      { tenantId: "tenant-1", sku: "EXT-2", name: "Imported Again", externalSource: "woocommerce", externalId: "42" },
      { productCatalogStore: store, now: fixedNow(T0 + 1) }
    );
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) expect(duplicate.error.code).toBe("product-catalog.EXTERNAL_REF_CONFLICT");
  });

  it("lists active products and supports category filters", async () => {
    const store = createMemoryProductCatalogStore();
    const categoryResult = await createCategory(
      { tenantId: "tenant-1", name: "Retail" },
      { productCatalogStore: store, now: fixedNow(T0) }
    );
    if (!categoryResult.ok) throw new Error(categoryResult.error.message);

    const product = await createProduct(
      {
        tenantId: "tenant-1",
        sku: "CAT-1",
        name: "Categorized",
        categoryIds: [categoryResult.data.category.id]
      },
      { productCatalogStore: store, now: fixedNow(T0 + 1) }
    );
    if (!product.ok) throw new Error(product.error.message);

    await updateProduct(
      { tenantId: "tenant-1", productId: product.data.product.id, active: false },
      { productCatalogStore: store, now: fixedNow(T0 + 2) }
    );

    const activeOnly = await listProducts({ tenantId: "tenant-1" }, { productCatalogStore: store });
    if (activeOnly.ok) expect(activeOnly.data.products).toHaveLength(0);

    const inactiveIncluded = await listProducts(
      { tenantId: "tenant-1", includeInactive: true, categoryId: categoryResult.data.category.id },
      { productCatalogStore: store }
    );
    if (inactiveIncluded.ok) {
      expect(inactiveIncluded.data.products).toHaveLength(1);
      expect(inactiveIncluded.data.products[0].categoryIds).toEqual([categoryResult.data.category.id]);
    }
  });
});

describe("product-catalog: combos", () => {
  it("expands combo components deterministically", async () => {
    const store = createMemoryProductCatalogStore();
    const componentA = await createSimple(store, "A");
    const componentB = await createSimple(store, "B");

    const combo = await createProduct(
      {
        tenantId: "tenant-1",
        sku: "KIT-1",
        name: "Kit",
        productType: "combo",
        comboComponents: [
          { productId: componentA.id, quantity: 2 },
          { productId: componentB.id, quantity: 3 }
        ]
      },
      { productCatalogStore: store, now: fixedNow(T0 + 3) }
    );
    if (!combo.ok) throw new Error(combo.error.message);

    const expanded = await expandProductComponents(
      { tenantId: "tenant-1", productId: combo.data.product.id, quantity: 4 },
      { productCatalogStore: store }
    );
    if (expanded.ok) {
      expect(expanded.data.components).toEqual([
        { productId: componentA.id, quantity: 8 },
        { productId: componentB.id, quantity: 12 }
      ]);
    }
  });

  it("rejects combo components on simple products", async () => {
    const store = createMemoryProductCatalogStore();
    const component = await createSimple(store, "C");
    const bad = await createProduct(
      {
        tenantId: "tenant-1",
        sku: "BAD",
        name: "Bad",
        productType: "simple",
        comboComponents: [{ productId: component.id, quantity: 1 }]
      },
      { productCatalogStore: store, now: fixedNow(T0 + 1) }
    );
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe("product-catalog.SIMPLE_PRODUCT_HAS_COMPONENTS");
  });
});
