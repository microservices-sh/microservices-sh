import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { listFiles } from "@microservices-sh/file-media";
import { requireOrgPermission } from "$lib/server/org-context";

export const load: PageServerLoad = async ({ locals, cookies, parent }) => {
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
