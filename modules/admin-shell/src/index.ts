export { moduleDefinition, manifest } from "./manifest";
export { defaultConfig, configSchema } from "./config";
export { events } from "./events";
export { permissions } from "./permissions";
export { resources } from "./resources";
export { createResourceRegistry, isKnownColumn, editableColumns } from "./registry";
export { hasPermission } from "./authz";
export { validateValues } from "./validate";
export { listRecords } from "./use-cases/list-records";
export { getRecord } from "./use-cases/get-record";
export { createRecord } from "./use-cases/create-record";
export { updateRecord } from "./use-cases/update-record";
export { deleteRecord } from "./use-cases/delete-record";
export { createD1TableGateway } from "./adapters/d1-table-gateway";
export { createMemoryTableGateway } from "./adapters/memory-table-gateway";
export type { ComputeFns, RelationWhereFns } from "./adapters/memory-table-gateway";
export type { ResourceRegistry } from "./registry";
export type { TableGateway } from "./ports";
export type {
  ResourceDefinition,
  ColumnDef,
  ColumnType,
  ComputedColumnDef,
  RelationDef,
  RelationComputedDef,
  SoftDeleteConfig,
  AdminActor,
  AdminRecord,
  AdminAuditEntry,
  ListQuery,
  ListResult
} from "./types";
