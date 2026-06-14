import { hasPermission } from "../authz";
import { defaultConfig } from "../config";
import { isKnownColumn, type ResourceRegistry } from "../registry";
import { listQuerySchema } from "../schemas";
import type { TableGateway } from "../ports";
import type { AdminActor, ListQuery } from "../types";

// List a resource: RBAC-gated, soft-deleted rows excluded by default, page size
// clamped, and sort/filter columns whitelisted against the definition. Returns a
// single page + total (the gateway uses one query + one count, never N+1).
export async function listRecords(
  registry: ResourceRegistry,
  resourceName: string,
  query: unknown,
  deps: { gateway: TableGateway; actor: AdminActor; config?: Partial<typeof defaultConfig> }
) {
  const def = registry.get(resourceName);
  if (!def) {
    return { ok: false as const, status: 404 as const, data: null, error: { code: "RESOURCE_NOT_FOUND", message: `Unknown admin resource: ${resourceName}.` } };
  }
  if (!hasPermission(deps.actor, def.permissions.read)) {
    return { ok: false as const, status: 403 as const, data: null, error: { code: "FORBIDDEN", message: "Missing read permission for this resource." } };
  }

  const parsed = listQuerySchema.safeParse(query ?? {});
  if (!parsed.success) {
    return { ok: false as const, status: 400 as const, data: null, error: { code: "INVALID_QUERY", message: "List query is invalid.", issues: parsed.error.issues } };
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
  return { ok: true as const, status: 200 as const, data: result };
}
