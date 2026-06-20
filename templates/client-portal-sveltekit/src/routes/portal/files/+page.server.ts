import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { listFilesScoped, createUploadTicketScoped, completeUploadScoped, authContext } from "@microservices-sh/file-media";

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user;
  if (!user || user.role !== "customer" || !user.customerId) {
    throw redirect(303, "/login");
  }

  // Enforced boundary (plan 33): tenant from the session; ownerId narrows to the
  // signed-in customer's own files within that tenant.
  const ctx = authContext({ orgId: locals.tenantId, actorId: user.id, roles: ["customer"] });
  const result = await listFilesScoped(
    ctx,
    { ownerId: user.customerId, status: "active" },
    { mediaStore: locals.mediaStore }
  );
  return {
    files: result.ok ? result.data.files : []
  };
};

export const actions: Actions = {
  // Two-step upload, end to end:
  //   1. createUploadTicket — validate + reserve a tenant-scoped key tied to the customer ownerId.
  //   2. PUT the bytes to that key, then completeUpload — verify and record.
  // The module owns content-type allowlisting, size limits, and lifecycle; the
  // route only moves bytes and maps results.
  upload: async ({ request, locals }) => {
    const user = locals.user;
    if (!user || user.role !== "customer" || !user.customerId) {
      return fail(401, { error: "Sign in to upload." });
    }

    // Enforced boundary (plan 33): the upload's tenant comes from the session; the
    // object key is tenant-prefixed by the module so bytes can't land under another
    // tenant's prefix. ownerId still ties the file to the signed-in customer.
    const ctx = authContext({ orgId: locals.tenantId, actorId: user.id, roles: ["customer"] });

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return fail(400, { error: "Choose a file to upload." });
    }

    const ticket = await createUploadTicketScoped(
      ctx,
      {
        ownerId: user.customerId,
        originalName: file.name,
        contentType: file.type || "application/octet-stream",
        declaredBytes: file.size
      },
      { mediaStore: locals.mediaStore }
    );
    if (!ticket.ok || !ticket.data.ticketId) {
      return fail(ticket.ok ? 422 : ticket.status, { error: ticket.ok ? "Upload was skipped." : ticket.error.message });
    }

    const bytes = await file.arrayBuffer();
    await locals.objectStorage.put(ticket.data.key, bytes, { contentType: ticket.data.contentType });
    // Memory object storage needs an explicit head() size; real R2 reports it.
    (locals.objectStorage as { setSize?: (key: string, info: { size: number; contentType?: string }) => void }).setSize?.(
      ticket.data.key,
      { size: bytes.byteLength, contentType: ticket.data.contentType }
    );

    const completed = await completeUploadScoped(
      ctx,
      { ticketId: ticket.data.ticketId },
      { mediaStore: locals.mediaStore, storage: locals.objectStorage }
    );
    if (!completed.ok) {
      return fail(completed.status, { error: completed.error.message });
    }

    return { uploaded: file.name };
  }
};
