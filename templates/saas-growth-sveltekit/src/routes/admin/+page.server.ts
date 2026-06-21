import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { listRecords } from "@microservices-sh/admin-shell";
import { adminRegistry } from "$lib/server/admin-registry";

// admin-shell actor: a super-admin carries the "*" permission so the generic
// gateway authorizes every resource. listRecords stays the thin entry point.
const SUPER_ADMIN_PERMISSIONS = ["*"];

export const load: PageServerLoad = async ({ locals }) => {
  // Defense in depth: /admin/+layout.server.ts already gates this, but re-check
  // the verified super-admin claim before minting the wildcard actor.
  if (!locals.user?.isSuperAdmin) throw error(403, "Super-admin access required.");
  const actor = { id: locals.user.id, permissions: SUPER_ADMIN_PERMISSIONS };

  const counts = await Promise.all(
    adminRegistry.list().map(async (def) => {
      const result = await listRecords(adminRegistry, def.name, { limit: 1 }, { gateway: locals.tableGateway, actor });
      return { name: def.name, total: result.ok ? result.data.total : 0 };
    })
  );

  return { counts };
};
