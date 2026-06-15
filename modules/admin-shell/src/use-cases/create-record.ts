import { ok, err } from "@microservices-sh/connection-contract";
import { hasPermission } from "../authz";
import { beforeWrite, onAdminAction } from "../hooks";
import { validateValues } from "../validate";
import { adminShellMeta } from "../meta";
import type { ResourceRegistry } from "../registry";
import type { TableGateway } from "../ports";
import type { AdminActor, AdminAuditEntry, AdminRecord, DomainEvent } from "../types";

// Create a record: RBAC write, validate against the definition (only editable
// columns, required checks), run beforeWrite, insert, then emit an audit entry
// plus an admin.record_created event carrying the correlationId.
export async function createRecord(
  registry: ResourceRegistry,
  resourceName: string,
  values: AdminRecord,
  deps: {
    gateway: TableGateway;
    actor: AdminActor;
    now?: () => number;
    correlationId?: string;
    audit?: (entry: AdminAuditEntry) => Promise<void>;
  }
) {
  const meta = adminShellMeta(deps);

  const def = registry.get(resourceName);
  if (!def) {
    return err(404, { code: "admin-shell.RESOURCE_NOT_FOUND", message: `Unknown admin resource: ${resourceName}.` }, meta);
  }
  if (!hasPermission(deps.actor, def.permissions.write)) {
    return err(403, { code: "admin-shell.FORBIDDEN", message: "Missing write permission for this resource." }, meta);
  }

  const validated = validateValues(def, values ?? {}, { partial: false });
  if (!validated.ok) {
    return err(400, { code: "admin-shell.VALIDATION_FAILED", message: "Values are invalid.", issues: validated.errors }, meta);
  }

  const hooked = await beforeWrite(resourceName, "create", validated.values);
  if (!hooked) {
    return err(409, { code: "admin-shell.WRITE_BLOCKED", message: "Create was blocked by beforeWrite." }, meta);
  }

  const id = "rec_" + crypto.randomUUID().slice(0, 16);
  await deps.gateway.insert(def, id, hooked);

  const entry: AdminAuditEntry = {
    action: "create",
    resource: resourceName,
    recordId: id,
    actorId: deps.actor.id,
    at: new Date(deps.now?.() ?? Date.now()).toISOString()
  };
  await onAdminAction(entry);
  if (deps.audit) await deps.audit(entry);

  const event: DomainEvent = {
    name: "admin.record_created",
    correlationId: meta.correlationId,
    payload: { resource: resourceName, recordId: id, actorId: deps.actor.id }
  };

  return ok(201, { id, event }, meta);
}
