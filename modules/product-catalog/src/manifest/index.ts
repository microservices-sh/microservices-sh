export const manifest = {
  schemaVersion: "2026-06-13",
  id: "product-catalog",
  name: "Product Catalog",
  version: "0.1.0",
  status: "draft",
  class: "core",
  summary:
    "Product and category catalog with SKU uniqueness, external mappings, combo products, and catalog events.",
  entrypoint: "src/index.ts",
  resources: [
    {
      type: "d1",
      binding: "DB",
      tables: ["catalog_categories", "products", "product_category_assignments", "combo_products", "domain_events"]
    }
  ],
  events: [
    "product-catalog.category_created",
    "product-catalog.category_updated",
    "product-catalog.product_created",
    "product-catalog.product_updated",
    "product-catalog.combo_updated"
  ]
} as const;

export const moduleDefinition = manifest;
