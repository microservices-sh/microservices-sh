import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { listFiles, createUploadTicket, completeUpload } from "@microservices-sh/file-media";

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user;
  if (!user || user.role !== "customer") {
    throw redirect(303, "/login");
  }

  const result = await listFiles({ tenantId: locals.tenantId, status: "active" }, { mediaStore: locals.mediaStore });
  return {
    files: result.ok ? result.data.files : []
  };
};

export const actions: Actions = {
  // Two-step upload, end to end:
  //   1. createUploadTicket — validate + reserve a tenant-scoped key.
  //   2. PUT the bytes to that key, then completeUpload — verify and record.
  // The module owns content-type allowlisting, size limits, and lifecycle; the
  // route only moves bytes and maps results.
  upload: async ({ request, locals }) => {
    const user = locals.user;
    if (!user || user.role !== "customer") {
      return fail(401, { error: "Sign in to upload." });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return fail(400, { error: "Choose a file to upload." });
    }

    const ticket = await createUploadTicket(
      {
        tenantId: locals.tenantId,
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

    const completed = await completeUpload(
      { ticketId: ticket.data.ticketId, tenantId: locals.tenantId },
      { mediaStore: locals.mediaStore, storage: locals.objectStorage }
    );
    if (!completed.ok) {
      return fail(completed.status, { error: completed.error.message });
    }

    return { uploaded: file.name };
  }
};
