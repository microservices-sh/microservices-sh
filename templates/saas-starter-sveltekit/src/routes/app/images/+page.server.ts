import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { generateImage, deleteImage, listImages } from "@microservices-sh/image-generation";
import { resolveImageDeps, tenantOf } from "$lib/server/image";

export const load: PageServerLoad = async ({ locals, platform }) => {
  if (!locals.user) throw redirect(303, "/login");
  const { store } = resolveImageDeps(platform);
  const res = await listImages({ tenantId: tenantOf(locals) }, { store });
  const images = res.ok ? res.data.images : [];
  return {
    images: images.map((i) => ({ id: i.id, prompt: i.prompt, provider: i.provider, aspectRatio: i.aspectRatio, createdAt: i.createdAt })),
  };
};

export const actions: Actions = {
  generate: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { error: "Sign in to generate images." });
    const form = await request.formData();
    const prompt = String(form.get("prompt") ?? "").trim();
    const aspectRatio = String(form.get("aspectRatio") ?? "1:1");
    const negativePrompt = String(form.get("negativePrompt") ?? "").trim() || undefined;
    if (!prompt) return fail(400, { error: "Prompt is required." });

    const deps = resolveImageDeps(platform);
    const res = await generateImage({ tenantId: tenantOf(locals), prompt, aspectRatio, negativePrompt }, deps);
    if (!res.ok) return fail(res.status, { error: res.error?.message ?? "Generation failed." });
    return { ok: true, generated: true };
  },

  delete: async ({ request, locals, platform }) => {
    if (!locals.user) return fail(401, { error: "Sign in to delete images." });
    const form = await request.formData();
    const imageId = String(form.get("imageId") ?? "");
    if (!imageId) return fail(400, { error: "imageId is required." });

    const { store, storage } = resolveImageDeps(platform);
    const res = await deleteImage({ tenantId: tenantOf(locals), imageId }, { store, storage });
    if (!res.ok) return fail(res.status, { error: res.error?.message ?? "Delete failed." });
    return { ok: true, deleted: true };
  },
};
