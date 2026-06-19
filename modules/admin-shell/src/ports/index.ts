import type { AdminRecord, ListQuery, ListResult, RelationDef, ResourceDefinition } from "../types";

// Generic data access driven by a ResourceDefinition. Implementations build SQL
// using ONLY identifiers from the definition (table/columns/primaryKey) and bind
// all values, so the registry — not the caller — controls the query shape.
export interface TableGateway {
  list(def: ResourceDefinition, query: ListQuery): Promise<ListResult>;
  get(def: ResourceDefinition, id: string): Promise<AdminRecord | null>;
  // Fetch a has-many child collection for a parent record. Builds SQL using ONLY
  // identifiers/expressions from `relation` (registry-trusted) and binds parentId.
  listRelated(relation: RelationDef, parentId: string): Promise<AdminRecord[]>;
  insert(def: ResourceDefinition, id: string, values: AdminRecord): Promise<void>;
  update(def: ResourceDefinition, id: string, values: AdminRecord): Promise<boolean>;
  // Sets the soft-delete column to its deleted value. Requires def.softDelete.
  softDelete(def: ResourceDefinition, id: string): Promise<boolean>;
  hardDelete(def: ResourceDefinition, id: string): Promise<boolean>;
}
