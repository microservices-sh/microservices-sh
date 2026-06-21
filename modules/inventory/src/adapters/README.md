# Inventory Adapters

- `memory-inventory-store` is for tests and local development.
- `d1-inventory-store` persists movement rows in D1.

Both adapters derive stock balances from `inventory_stock_movements`; neither stores a cached balance table.
