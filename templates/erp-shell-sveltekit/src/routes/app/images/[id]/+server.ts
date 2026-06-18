import type { RequestHandler } from "./$types";
import { error } from "@sveltejs/kit";
import { getImage } from "@microservices-sh/image-generation";
import { loadCompanyContext } from "$lib/server/org-context";
import { isModuleEnabled } from "$lib/server/modules";

// Serve a generated image's raw bytes from object storage. Tenant-scoped: the
// image must belong to the signed-in user's company, so one company can never
// read another's bytes by guessing ids.
export const GET: RequestHandler = async ({ params, locals, cookies, platform }) => {
  if (!isModuleEnabled("image-generation", platform)) throw error(404, "Not found");
  if (!locals.user) throw error(401, "Sign in required");

  const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
  if (!org) throw error(403, "No company");

  const result = await getImage({ imageId: params.id, tenantId: org.id }, { store: locals.imageStore });
  if (!result.ok || !result.data.image || result.data.image.tenantId !== org.id) throw error(404, "Not found");

  const obj = await locals.imageStorage.get(result.data.image.key);
  if (!obj) throw error(404, "Image bytes missing");

  return new Response(obj.body, {
    headers: {
      "content-type": obj.contentType ?? result.data.image.mimeType,
      "cache-control": "private, max-age=300"
    }
  });
};
