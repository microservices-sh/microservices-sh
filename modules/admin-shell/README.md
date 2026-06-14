# Admin Shell Module

Status: `available` (v0.1.0) · Class: `platform` · Risk: `high`

A schema-driven admin layer for Cloudflare Workers. You declare your existing D1
tables as **resources**; the module gives you generic, governed CRUD over them.
The host app renders the UI (SvelteKit etc.); this module owns the safe data
access. It encapsulates what agents get wrong on generated admin screens:

1. **Authz on every action** — each resource declares `read`/`write` permissions;
   every use case checks them. No "any logged-in user can edit anything".
2. **Soft-delete awareness** — delete respects a resource's `softDelete` config
   instead of always hard-deleting (no accidental data loss).
3. **Injection-safe generic SQL** — table/column identifiers come only from the
   registry (validated + quoted); all values are bound.
4. **No N+1** — list is one query + one count, with clamped pagination.

## Define resources and wire it

```ts
import {
  createResourceRegistry, createD1TableGateway,
  listRecords, getRecord, createRecord, updateRecord, deleteRecord
} from "@microservices-sh/admin-shell";

const registry = createResourceRegistry([
  {
    name: "customers",
    table: "customers",
    primaryKey: "id",
    columns: [
      { name: "name", type: "string", editable: true, required: true },
      { name: "email", type: "string", editable: true },
      { name: "status", type: "string" }
    ],
    searchable: ["name", "email"],
    permissions: { read: "customer.read", write: "customer.write" },
    softDelete: { column: "status", deletedValue: "deleted" },
    defaultSort: { column: "name", direction: "asc" }
  }
]);

const gateway = createD1TableGateway(env.DB);
const actor = { id: staff.id, permissions: staff.permissions };

const page = await listRecords(registry, "customers", { search: "ada", limit: 25 }, { gateway, actor });
await updateRecord(registry, "customers", id, { email: "new@x.com" }, { gateway, actor });
await deleteRecord(registry, "customers", id, { gateway, actor }); // soft-deletes (status=deleted)
```

Wire the `onAdminAction` hook (or the `audit` dep) to the **audit-log** module to
record who changed what.

## Resources

Owns no tables — operates over the host's existing D1 tables via the registry. The
DB binding is supplied by the host when constructing the gateway.

## Verification

```bash
pnpm --filter @microservices-sh/admin-shell build
pnpm --filter @microservices-sh/admin-shell check:spec
```
