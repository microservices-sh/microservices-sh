# Project Progress Adapters

Adapters provided:

- `createProjectProgressMemoryStore` for tests and local demo flows.
- `createD1ProjectProgressStore(db)` for Cloudflare D1 persistence.

The D1 adapter uses prepared statements behind the `ProjectProgressStore` port. Route adapters remain responsible for auth, storage signing, upload handling, and public URL policy.
