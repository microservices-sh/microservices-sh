import type { RecordEventInput } from "./schemas";

// Customization seam: redact or drop sensitive fields before an audit record is
// persisted. Default is pass-through.
export async function redactAuditPayload(input: RecordEventInput): Promise<RecordEventInput> {
  return input;
}

export async function beforeAuditExport(filter: { entityType?: string; entityId?: string }) {
  return filter;
}
