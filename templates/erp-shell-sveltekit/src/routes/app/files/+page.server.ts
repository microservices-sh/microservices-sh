import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { listFiles, createUploadTicket, completeUpload } from "@microservices-sh/file-media";
import { recordEvent } from "@microservices-sh/audit-log";
import { requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("file-media", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  // Read gate: org.read lets an employee view stored files (metadata only).
  await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);

  // Files are scoped to the single company org; its id is the tenant.
  const result = await listFiles({ tenantId: activeOrgId, status: "active" }, { mediaStore: locals.mediaStore });
  const files = result.ok ? result.data.files : [];

  return {
    files: files.map((file) => ({
      id: file.id,
      name: file.originalName,
      contentType: file.contentType,
      bytes: file.bytes,
      createdAt: file.createdAt
    }))
  };
};

export const actions: Actions = {
  // Two-step upload via the file-media module: reserve a tenant-scoped ticket,
  // put the bytes at the reserved key, then confirm. In dev the object store is
  // in-memory (setSize feeds completeUpload's size check); in prod it's R2.
  upload: async ({ request, locals, cookies, parent }) => {
    const { activeOrgId } = await parent();
    if (!activeOrgId || !locals.user) return fail(403, { error: "Not signed in to a company." });

    // Write gate: uploading requires member.manage in the company org.
    await requireOrgPermission(cookies, locals.user.id, activeOrgId, "member.manage", locals.rbacStore);

    const file = (await request.formData()).get("file");
    if (!(file instanceof File) || file.size === 0) {
      return fail(400, { error: "Choose a file to upload." });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const contentType = file.type || "application/octet-stream";

    const ticket = await createUploadTicket(
      { tenantId: activeOrgId, originalName: file.name, contentType, declaredBytes: bytes.length },
      { mediaStore: locals.mediaStore }
    );
    if (!ticket.ok || !ticket.data?.ticketId) {
      return fail(ticket.status ?? 400, { error: ticket.error?.message ?? "Upload could not be started." });
    }

    await locals.objectStorage.put(ticket.data.key, bytes, { contentType });
    (locals.objectStorage as { setSize?: (k: string, i: { size: number; contentType?: string }) => void }).setSize?.(
      ticket.data.key,
      { size: bytes.length, contentType }
    );

    const done = await completeUpload(
      { ticketId: ticket.data.ticketId, tenantId: activeOrgId },
      { mediaStore: locals.mediaStore, storage: locals.objectStorage }
    );
    if (!done.ok) {
      return fail(done.status ?? 400, { error: done.error?.message ?? "Upload failed to complete." });
    }

    await recordEvent(
      { eventName: "file.uploaded", actorId: locals.user.id, entityType: "file", entityId: ticket.data.ticketId, source: "files", payload: { name: file.name } },
      { auditStore: locals.auditStore }
    );

    return { uploaded: true, name: file.name };
  }
};
