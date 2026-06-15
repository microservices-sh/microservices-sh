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
