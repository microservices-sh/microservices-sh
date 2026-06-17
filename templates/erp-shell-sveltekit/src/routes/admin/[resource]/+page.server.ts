import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { listRecords } from "@microservices-sh/admin-shell";
import { adminRegistry } from "$lib/server/admin-registry";

const SUPER_ADMIN_PERMISSIONS = ["*"];

export const load: PageServerLoad = async ({ params, url, locals }) => {
  // Defense in depth: /admin/+layout.server.ts already gates this, but re-check
  // the verified super-admin claim before minting the wildcard actor.
  if (!locals.user?.isSuperAdmin) throw error(403, "Super-admin access required.");
  const def = adminRegistry.get(params.resource);
  if (!def) throw error(404, `Unknown admin resource: ${params.resource}`);

  const actor = { id: locals.user.id, permissions: SUPER_ADMIN_PERMISSIONS };
  const search = url.searchParams.get("q") ?? undefined;

  // Thin adapter: parse the query, hand the resource name + query to admin-shell,
  // map the framework-neutral list result to page data. Columns come from the
  // registry definition, never request input.
  const result = await listRecords(adminRegistry, params.resource, { search, limit: 25 }, { gateway: locals.tableGateway, actor });
  if (!result.ok) throw error(result.status, result.error?.message ?? "Could not list records.");

  return {
    resource: params.resource,
    search: search ?? "",
    columns: def.columns.filter((col) => col.listable !== false).map((col) => ({ name: col.name, label: col.label ?? col.name })),
    rows: result.data.rows,
    total: result.data.total
  };
};
