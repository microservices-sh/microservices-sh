# Estimate Quote Adapters

This module ships a deterministic memory store for tests and a Cloudflare D1 store for production templates. Keep invoice creation side effects outside this module; conversion returns an invoice draft payload and records the invoice id supplied by the caller.

Data-access standard (docs/module-data-access-standard.md): the D1 adapter stays behind the repository port, with a parallel in-memory adapter for fast unit tests.
