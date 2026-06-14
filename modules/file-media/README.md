# File & Media Module

Status: `available` (v0.1.0) · Class: `provider` · Risk: `medium`

R2-backed file storage for Cloudflare Workers. Used by client portals, customer
avatars, document uploads, CMS images, and order/service attachments. It
encapsulates the upload failures AI agents reliably ship:

1. **Tenant-scoped keys** — every object key is `${tenantId}/${uploadId}/${name}`,
   built through one helper (`buildObjectKey`), so one tenant can never read or
   overwrite another's objects. Listing/delete are tenant-guarded twice.
2. **Validated upload tickets** — content type is allow-listed and a size ceiling
   is enforced *before* an upload is accepted; filenames are sanitized (no path
   traversal, no executable masquerade).
3. **Completion check, not blind trust** — `completeUpload` verifies the object
   actually landed and is within the size limit before recording it.
4. **Orphan cleanup** — `expireStaleTickets` deletes abandoned objects for tickets
   that were never completed, so R2 does not silently accumulate bytes.

## Upload flow (two steps)

```ts
import { createUploadTicket, completeUpload, createD1MediaStore, createR2ObjectStorage } from "@microservices-sh/file-media";

const mediaStore = createD1MediaStore(env.DB);
const storage = createR2ObjectStorage(env.MEDIA_BUCKET);

// 1) reserve a tenant-scoped key + ticket
const ticket = await createUploadTicket(
  { tenantId, originalName: "logo.png", contentType: "image/png" },
  { mediaStore }
);

// 2) host route streams the bytes to ticket.data.key, then:
await storage.put(ticket.data.key, requestBody, { contentType: "image/png" });
const file = await completeUpload({ ticketId: ticket.data.ticketId, tenantId }, { mediaStore, storage });
```

## Maintenance & lifecycle

- `expireStaleTickets({ mediaStore, storage })` — run on a **jobs-workflows**
  schedule to clean orphaned uploads.
- `deleteFile({ fileId, tenantId }, { mediaStore, storage })` — soft-deletes the
  record and removes the R2 object.
- `listFiles({ tenantId }, { mediaStore })` — tenant-scoped listing.
- Image variants: wire the `onFileUploaded` hook to `enqueueJob` from
  jobs-workflows so resizing/transform runs async (never in the upload handler).

## Resources

- D1 (`DB`): `upload_tickets`, `media_files` (migration `0001`).
- R2 (`MEDIA_BUCKET`): object bytes.

## Verification

```bash
pnpm --filter @microservices-sh/file-media build
pnpm --filter @microservices-sh/file-media check:spec
```
