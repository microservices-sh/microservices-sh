import { ok, err } from "@microservices-sh/connection-contract";
import { hasPermission } from "../authz";
import { defaultConfig } from "../config";
import { isKnownColumn, type ResourceRegistry } from "../registry";
import { listQuerySchema } from "../schemas";
import { adminShellMeta } from "../meta";
import type { TableGateway } from "../ports";
import type { AdminActor, ListQuery } from "../types";

// List a resource: RBAC-gated, soft-deleted rows excluded by default, page size
// clamped, and sort/filter columns whitelisted against the definition. Returns a
// single page + total (the gateway uses one query + one count, never N+1).
export async function listRecords(
  registry: ResourceRegistry,
  resourceName: string,
  query: unknown,
  deps: { gateway: TableGateway; actor: AdminActor; config?: Partial<typeof defaultConfig>; correlationId?: string }
) {
  const meta = adminShellMeta(deps);

  const def = registry.get(resourceName);
  if (!def) {
    return err(404, { code: "admin-shell.RESOURCE_NOT_FOUND", message: `Unknown admin resource: ${resourceName}.` }, meta);
  }
  if (!hasPermission(deps.actor, def.permissions.read)) {
    return err(403, { code: "admin-shell.FORBIDDEN", message: "Missing read permission for this resource." }, meta);
  }

  const parsed = listQuerySchema.safeParse(query ?? {});
  if (!parsed.success) {
    return err(400, { code: "admin-shell.INVALID_QUERY", message: "List query is invalid.", issues: parsed.error.issues }, meta);
  }

  const cfg = { ...defaultConfig, ...deps.config };
  const limit = Math.min(parsed.data.limit ?? cfg.defaultPageSize, cfg.maxPageSize);
  const offset = parsed.data.offset ?? 0;

  // Seeing soft-deleted rows requires the explicit flag AND write permission.
  const includeDeleted =
    (parsed.data.includeDeleted ?? cfg.showDeletedByDefault) && hasPermission(deps.actor, def.permissions.write);

  let sort = parsed.data.sort ?? def.defaultSort;
  if (sort && !isKnownColumn(def, sort.column)) sort = def.defaultSort;

  const filters: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(parsed.data.filters ?? {})) {
    if (isKnownColumn(def, key)) filters[key] = value;
  }

  const listQuery: ListQuery = { search: parsed.data.search, filters, sort, limit, offset, includeDeleted };
  const result = await deps.gateway.list(def, listQuery);
  return ok(200, result, meta);
}
