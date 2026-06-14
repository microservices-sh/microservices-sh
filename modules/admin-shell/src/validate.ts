import type { AdminRecord, ColumnDef, ResourceDefinition } from "./types";

export interface ValidationResult {
  ok: boolean;
  values: AdminRecord;
  errors: Array<{ column: string; message: string }>;
}

function coerce(col: ColumnDef, raw: unknown): { value: unknown; error?: string } {
  if (raw === null || raw === undefined) return { value: null };
  switch (col.type) {
    case "number": {
      const n = typeof raw === "number" ? raw : Number(raw);
      return Number.isFinite(n) ? { value: n } : { value: null, error: "must be a number" };
    }
    case "boolean":
      return { value: raw === true || raw === "true" || raw === 1 || raw === "1" ? 1 : 0 };
    case "json":
      try {
        return { value: typeof raw === "string" ? raw : JSON.stringify(raw) };
      } catch {
        return { value: null, error: "must be JSON-serializable" };
      }
    case "datetime":
    case "string":
    default:
      return { value: String(raw) };
  }
}

// Validate and coerce values against a resource definition, accepting ONLY
// columns marked editable. partial=true skips required checks (used by update).
export function validateValues(
  def: ResourceDefinition,
  input: AdminRecord,
  opts: { partial: boolean }
): ValidationResult {
  const editable = def.columns.filter((c) => c.editable);
  const editableNames = new Set(editable.map((c) => c.name));
  const values: AdminRecord = {};
  const errors: Array<{ column: string; message: string }> = [];

  // Reject any attempt to write a non-editable / unknown column outright.
  for (const key of Object.keys(input)) {
    if (!editableNames.has(key)) {
      errors.push({ column: key, message: "is not editable" });
    }
  }

  for (const col of editable) {
    const provided = Object.prototype.hasOwnProperty.call(input, col.name);
    if (!provided) {
      if (!opts.partial && col.required) errors.push({ column: col.name, message: "is required" });
      continue;
    }
    const { value, error } = coerce(col, input[col.name]);
    if (error) {
      errors.push({ column: col.name, message: error });
      continue;
    }
    if (!opts.partial && col.required && (value === null || value === "")) {
      errors.push({ column: col.name, message: "is required" });
      continue;
    }
    values[col.name] = value;
  }

  return { ok: errors.length === 0, values, errors };
}
