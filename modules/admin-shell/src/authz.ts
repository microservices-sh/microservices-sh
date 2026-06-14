import type { AdminActor } from "./types";

// Permission check with wildcard support. "*" grants everything; otherwise the
// exact permission string must be present. Every admin use case calls this before
// touching data — the authz gate agents forget on generated admin surfaces.
export function hasPermission(actor: AdminActor | null | undefined, permission: string): boolean {
  if (!actor || !Array.isArray(actor.permissions)) return false;
  return actor.permissions.includes("*") || actor.permissions.includes(permission);
}
