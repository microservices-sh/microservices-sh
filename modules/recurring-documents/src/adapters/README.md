# Recurring Documents Adapters

This module ships memory and Cloudflare D1 stores for recurring document templates and line items. Generation returns draft invoice/bill payloads; invoice, AP, email, and posting side effects stay in caller-owned adapters.

Data-access standard (docs/module-data-access-standard.md): the D1 adapter stays behind the repository port, with a parallel in-memory adapter for fast unit tests.
