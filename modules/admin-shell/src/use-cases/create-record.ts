import { hasPermission } from "../authz";
import { beforeWrite, onAdminAction } from "../hooks";
import { validateValues } from "../validate";
import type { ResourceRegistry } from "../registry";
import type { TableGateway } from "../ports";
import type { AdminActor, AdminAuditEntry, AdminRecord } from "../types";

// Create a record: RBAC write, validate against the definition (only editable
// columns, required checks), run beforeWrite, insert, then emit an audit entry.
export async function createRecord(
  registry: ResourceRegistry,
  resourceName: string,
  values: AdminRecord,
  deps: {
    gateway: TableGateway;
    actor: AdminActor;
    now?: () => number;
    audit?: (entry: AdminAuditEntry) => Promise<void>;
  }
) {
  const def = registry.get(resourceName);
  if (!def) {
    return { ok: false as const, status: 404 as const, data: null, error: { code: "RESOURCE_NOT_FOUND", message: `Unknown admin resource: ${resourceName}.` } };
  }
  if (!hasPermission(deps.actor, def.permissions.write)) {
    return { ok: false as const, status: 403 as const, data: null, error: { code: "FORBIDDEN", message: "Missing write permission for this resource." } };
  }

  const validated = validateValues(def, values ?? {}, { partial: false });
  if (!validated.ok) {
    return { ok: false as const, status: 400 as const, data: null, error: { code: "VALIDATION_FAILED", message: "Values are invalid.", issues: validated.errors } };
  }

  const hooked = await beforeWrite(resourceName, "create", validated.values);
  if (!hooked) {
    return { ok: false as const, status: 409 as const, data: null, error: { code: "WRITE_BLOCKED", message: "Create was blocked by beforeWrite." } };
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

  return { ok: true as const, status: 201 as const, data: { id } };
}
