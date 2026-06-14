import type { AdminAuditEntry, AdminRecord } from "./types";

// Customization seam: inspect/transform values before a create or update, or
// return null to block the write. Default pass-through.
export async function beforeWrite(
  _resource: string,
  _action: "create" | "update",
  values: AdminRecord
): Promise<AdminRecord | null> {
  return values;
}

// Customization seam: record an admin mutation (e.g. forward to the audit-log
// module). Default no-op.
export async function onAdminAction(_entry: AdminAuditEntry): Promise<void> {
  return;
}
