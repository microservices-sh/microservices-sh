export type ColumnType = "string" | "number" | "boolean" | "datetime" | "json";

export interface ColumnDef {
  name: string;
  type: ColumnType;
  label?: string;
  // Shown in the list view. Defaults to true.
  listable?: boolean;
  // Editable via create/update. Defaults to false (read-only) — opt in explicitly.
  editable?: boolean;
  // Required on create. Defaults to false.
  required?: boolean;
}

// A read-only, developer-authored computed/subquery column. `expression` is raw
// SQL (e.g. a correlated subquery) that the D1 gateway writes into the SELECT
// projection, aliased AS `name`. SECURITY: `expression` is TRUSTED and comes ONLY
// from the registry definition — never from request input — so it is the
// developer's responsibility (like any hand-written query) to keep it injection-
// free. The alias `name` is still identifier-validated and quoted. Computed
// columns are projected on read but never accepted for writes, and are not used
// as filter/sort identifiers unless also declared as a real `ColumnDef`.
export interface ComputedColumnDef {
  name: string;
  type: ColumnType;
  label?: string;
  // Trusted SQL expression from the registry. Yields the column's value, e.g.
  // "(SELECT COUNT(*) FROM workspaces w WHERE w.owner_id = <table>.id)".
  expression: string;
}

// Soft-delete config: delete sets `column` to `deletedValue`; the active filter
// excludes those rows. When absent, delete is a hard DELETE.
export interface SoftDeleteConfig {
  column: string;
  deletedValue: string;
}

export interface ResourceDefinition {
  name: string;
  table: string;
  primaryKey: string;
  columns: ColumnDef[];
  // Read-only computed/subquery columns projected onto every list/get row.
  computed?: ComputedColumnDef[];
  // Columns matched (LIKE) by the list search box.
  searchable?: string[];
  // Permission strings the actor must hold for read vs write actions.
  permissions: { read: string; write: string };
  softDelete?: SoftDeleteConfig;
  defaultSort?: { column: string; direction: "asc" | "desc" };
}

// The authenticated operator performing an admin action.
export interface AdminActor {
  id: string;
  permissions: string[];
}

export interface ListQuery {
  search?: string;
  filters?: Record<string, string | number | boolean>;
  sort?: { column: string; direction: "asc" | "desc" };
  limit?: number;
  offset?: number;
  // Admin override to include soft-deleted rows. Ignored when no softDelete config.
  includeDeleted?: boolean;
}

export type AdminRecord = Record<string, unknown>;

export interface ListResult {
  rows: AdminRecord[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminAuditEntry {
  action: "create" | "update" | "delete";
  resource: string;
  recordId: string;
  actorId: string;
  at: string;
}

// Lifecycle event emitted on a successful admin mutation. Carries the
// correlationId so downstream consumers (e.g. audit-log) can tie it back to the
// originating request. See Plan 25 §4.
export interface DomainEvent {
  name: "admin.record_created" | "admin.record_updated" | "admin.record_deleted";
  correlationId: string;
  payload: { resource: string; recordId: string; actorId: string };
}
