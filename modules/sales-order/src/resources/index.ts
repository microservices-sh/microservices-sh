export const salesOrderResources = [
  {
    "type": "d1",
    "binding": "DB",
    "tables": [
      "sales_orders",
      "sales_order_line_items",
      "domain_events"
    ]
  }
] as const;
