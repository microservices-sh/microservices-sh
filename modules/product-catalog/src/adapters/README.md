# Product Catalog Adapters

Add D1, memory, provider, or framework adapters here. Keep provider side effects behind explicit function calls.

Data-access standard (docs/module-data-access-standard.md): the D1 adapter uses `drizzle-orm/d1` behind the repository port, with a parallel in-memory adapter for fast unit tests. `modules/booking` is the reference implementation.
