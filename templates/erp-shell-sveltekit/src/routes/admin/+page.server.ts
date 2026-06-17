import type { PageServerLoad } from "./$types";
import { listRecords } from "@microservices-sh/admin-shell";
import { adminRegistry } from "$lib/server/admin-registry";

// admin-shell actor: a super-admin carries the "*" permission so the generic
// gateway authorizes every resource. listRecords stays the thin entry point.
const SUPER_ADMIN_PERMISSIONS = ["*"];

export const load: PageServerLoad = async ({ locals }) => {
  const actor = { id: locals.user!.id, permissions: SUPER_ADMIN_PERMISSIONS };

  const counts = await Promise.all(
    adminRegistry.list().map(async (def) => {
      const result = await listRecords(adminRegistry, def.name, { limit: 1 }, { gateway: locals.tableGateway, actor });
      return { name: def.name, total: result.ok ? result.data.total : 0 };
    })
  );

  return { counts };
};
