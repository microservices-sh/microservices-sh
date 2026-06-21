export const productCatalogResources = [
  {
    "type": "d1",
    "binding": "DB",
    "tables": [
      "catalog_categories",
      "products",
      "product_category_assignments",
      "combo_products",
      "domain_events"
    ]
  }
] as const;
