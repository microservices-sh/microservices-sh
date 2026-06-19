import { ok, err } from "@microservices-sh/connection-contract";
import { hasPermission } from "../authz";
import { adminShellMeta } from "../meta";
import type { ResourceRegistry } from "../registry";
import type { TableGateway } from "../ports";
import type { AdminActor } from "../types";

// Fetch one record by primary key. RBAC-gated on the resource's read permission.
export async function getRecord(
  registry: ResourceRegistry,
  resourceName: string,
  id: string,
  deps: { gateway: TableGateway; actor: AdminActor; correlationId?: string }
) {
  const meta = adminShellMeta(deps);

  const def = registry.get(resourceName);
  if (!def) {
    return err(404, { code: "admin-shell.RESOURCE_NOT_FOUND", message: `Unknown admin resource: ${resourceName}.` }, meta);
  }
  if (!hasPermission(deps.actor, def.permissions.read)) {
    return err(403, { code: "admin-shell.FORBIDDEN", message: "Missing read permission for this resource." }, meta);
  }

  const record = await deps.gateway.get(def, id);
  if (!record) {
    return err(404, { code: "admin-shell.RECORD_NOT_FOUND", message: "Record not found." }, meta);
  }

  // Attach declared has-many child collections (detail reads only). Each relation
  // is fetched with one query keyed on the parent's primary key; identifiers and
  // any extra WHERE come from the trusted registry definition, parentId is bound.
  if (def.relations?.length) {
    for (const relation of def.relations) {
      record[relation.name] = await deps.gateway.listRelated(relation, id);
    }
  }

  return ok(200, { record }, meta);
}
