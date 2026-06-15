import type { RequestHandler } from "./$types";
import { error } from "@sveltejs/kit";
import { getImage } from "@microservices-sh/image-generation";
import { resolveImageDeps, tenantOf } from "$lib/server/image";

// Serve the bytes for a generated image, scoped to the caller's tenant. The
// gallery <img src> points here.
export const GET: RequestHandler = async ({ params, locals, platform }) => {
  if (!locals.user) throw error(401, "Unauthorized");
  const { store, storage } = resolveImageDeps(platform);

  const res = await getImage({ tenantId: tenantOf(locals), imageId: params.id }, { store });
  if (!res.ok) throw error(404, "Image not found");

  const object = await storage.get(res.data.image.key);
  if (!object) throw error(404, "Image bytes not found");

  return new Response(object.body, {
    headers: {
      "Content-Type": object.contentType || res.data.image.mimeType || "image/png",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
};
