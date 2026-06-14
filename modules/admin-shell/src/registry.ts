import type { ColumnDef, ResourceDefinition } from "./types";

export interface ResourceRegistry {
  get(name: string): ResourceDefinition | null;
  list(): ResourceDefinition[];
}

// Normalize a definition (defaults for primaryKey/listable/editable) and freeze.
function normalize(def: ResourceDefinition): ResourceDefinition {
  return {
    ...def,
    primaryKey: def.primaryKey || "id",
    columns: def.columns.map((col: ColumnDef) => ({
      listable: col.listable !== false,
      editable: col.editable === true,
      required: col.required === true,
      ...col
    }))
  };
}

// The set of admin-managed resources. Names must be unique. Definitions are the
// ONLY source of table/column identifiers used to build SQL — never user input —
// which is what keeps the generic gateway injection-safe.
export function createResourceRegistry(defs: ResourceDefinition[]): ResourceRegistry {
  const byName = new Map<string, ResourceDefinition>();
  for (const def of defs) {
    if (byName.has(def.name)) throw new Error(`Duplicate admin resource: ${def.name}`);
    byName.set(def.name, normalize(def));
  }
  return {
    get(name) {
      return byName.get(name) ?? null;
    },
    list() {
      return [...byName.values()];
    }
  };
}

// Helpers used by the gateway to keep identifiers whitelisted to the definition.
export function isKnownColumn(def: ResourceDefinition, name: string): boolean {
  return def.columns.some((col) => col.name === name) || name === def.primaryKey;
}

export function editableColumns(def: ResourceDefinition): ColumnDef[] {
  return def.columns.filter((col) => col.editable);
}
