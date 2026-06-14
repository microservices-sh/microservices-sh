# Detached API Boundary

The template must not put business logic directly in SvelteKit route files.

## Layers

| Layer | Owns | Example |
|-------|------|---------|
| Route adapter | HTTP parsing and response mapping | `src/routes/portal/files/+page.server.ts` |
| Use case | domain orchestration | `createUploadTicket`, `createInvoice` |
| Port | dependency contract | `InvoiceStore`, `MediaStore` |
| Adapter | concrete infrastructure | `D1InvoiceStore`, `R2ObjectStorage` |
| Hook | user customization | `beforeInvoiceIssue`, `allowContentType` |

## Route Adapter Shape

Server `load` functions and form `actions` parse framework inputs, call module
use cases with injected dependencies from `locals`, and map results to SvelteKit
responses. They never embed domain rules.

```ts
export const load: PageServerLoad = async ({ locals }) => {
  const result = await listInvoices(
    { tenantId: locals.tenantId, customerId: locals.user.customerId },
    { invoiceStore: locals.invoiceStore }
  );
  return { invoices: result.ok ? result.data.invoices : [] };
};
```

For API responses (custom `+server.ts` endpoints), map the framework-neutral
result through `toSvelteKitResponse`:

```ts
import { toSvelteKitResponse } from "$lib/server/adapters/sveltekit-response";

export const POST = async ({ request, locals }) => {
  const result = await createInvoice(await request.json(), { invoiceStore: locals.invoiceStore });
  return toSvelteKitResponse(result);
};
```

## Use Case Shape

```ts
export async function createInvoice(input, deps): Promise<InvoiceResult> {
  // validate input
  // compute totals (integer cents)
  // persist the draft via the InvoiceStore port
  // return a framework-neutral result
}
```

## Port Shape

```ts
export interface InvoiceStore {
  insert(invoice: Invoice): Promise<void>;
  get(id: string): Promise<Invoice | null>;
  list(filter: InvoiceFilter): Promise<Invoice[]>;
  listLineItems(invoiceId: string): Promise<InvoiceLineItem[]>;
  // ...
}
```

## File Uploads: Two-Step Boundary

File uploads cross the boundary in two module calls — the route only moves bytes:

1. `createUploadTicket` reserves a tenant-scoped key and validates content type / size.
2. The route PUTs the bytes to the ticket key, then `completeUpload` verifies the
   object landed and records a `MediaFile`.

The same use cases should be callable from SvelteKit, Hono, MCP tools, tests, and
future background jobs.
