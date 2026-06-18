import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { listImages, generateImage, deleteImage } from "@microservices-sh/image-generation";
import { recordEvent } from "@microservices-sh/audit-log";
import { requireOrgPermission, loadCompanyContext } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";

// Reference UI for @microservices-sh/image-generation: a tenant-scoped gallery +
// a prompt form. Bytes live in object storage (R2 in prod, memory locally; the
// dev provider returns placeholder bytes so the flow works with no API key). The
// raw image bytes are served by ./[id]/+server.ts.
export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("image-generation", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);

  const result = await listImages({ tenantId: activeOrgId }, { store: locals.imageStore });
  const images = result.ok ? result.data.images : [];

  return {
    canManage: permissions.includes("*") || permissions.includes("member.manage"),
    images: images.map((img) => ({
      id: img.id,
      prompt: img.prompt,
      status: img.status,
      mimeType: img.mimeType,
      createdAt: img.createdAt
    }))
  };
};

export const actions: Actions = {
  generate: async ({ request, locals, cookies }) => {
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const prompt = String(form.get("prompt") ?? "").trim();
    const aspectRatio = String(form.get("aspectRatio") ?? "1:1");
    if (!prompt) return fail(400, { error: "Enter a prompt." });

    const result = await generateImage(
      { tenantId: org.id, prompt, aspectRatio },
      { providers: locals.imageProviders, store: locals.imageStore, storage: locals.imageStorage }
    );
    if (!result.ok) return fail(result.status ?? 400, { error: result.error?.message ?? "Image generation failed." });

    await recordEvent(
      { eventName: "image.generated", actorId: locals.user.id, entityType: "image", entityId: result.data.id, source: "app/images", payload: { prompt } },
      { auditStore: locals.auditStore }
    );
    return { ok: true, generated: true };
  },

  delete: async ({ request, locals, cookies }) => {
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const imageId = String((await request.formData()).get("imageId") ?? "").trim();
    if (!imageId) return fail(400, { error: "Missing image." });

    const result = await deleteImage(
      { imageId, tenantId: org.id },
      { store: locals.imageStore, storage: locals.imageStorage }
    );
    if (!result.ok) return fail(result.status ?? 400, { error: result.error?.message ?? "Delete failed." });

    await recordEvent(
      { eventName: "image.deleted", actorId: locals.user.id, entityType: "image", entityId: imageId, source: "app/images", payload: {} },
      { auditStore: locals.auditStore }
    );
    return { ok: true, deleted: true };
  }
};
