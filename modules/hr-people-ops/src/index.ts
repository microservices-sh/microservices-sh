export { moduleDefinition, manifest } from "./manifest";
export { defaultConfig, configSchema } from "./config";
export {
  attendanceRecordSchema,
  attendanceStatusSchema,
  departmentSchema,
  employeeSchema,
  employmentStatusSchema,
  employmentTypeSchema,
  hrPeopleOpsConfigSchema,
  hrPeopleOpsRecordSchema,
  leaveBalanceSchema,
  leaveRequestSchema,
  leaveRequestStatusSchema,
  leaveTypeSchema,
  positionSchema
} from "./schemas";
export { defaultHrPeopleOpsHooks } from "./hooks";
export { hrPeopleOpsEvents } from "./events";
export { hrPeopleOpsPermissions } from "./permissions";
export { hrPeopleOpsResources } from "./resources";
export { createD1HrPeopleOpsStore } from "./adapters/d1";
export { createHrPeopleOpsMemoryStore } from "./adapters/memory";
export { createHrPeopleOpsService, createSequentialHrPeopleOpsIdFactory, getHrPeopleOpsModuleStatus } from "./service";
export type { HrPeopleOpsStore } from "./ports";
export type { HrPeopleOpsMemoryStoreState } from "./adapters/memory";
export type { HrPeopleOpsService, HrPeopleOpsServiceDeps } from "./service";
export type {
  ApproveLeaveRequestInput,
  AssignLeaveBalanceInput,
  AttendanceRecord,
  AttendanceStatus,
  CancelLeaveRequestInput,
  CreateDepartmentInput,
  CreateEmployeeInput,
  CreateLeaveTypeInput,
  CreatePositionInput,
  Department,
  Employee,
  EmployeeSnapshot,
  EmploymentStatus,
  EmploymentType,
  HrPeopleOpsConfig,
  HrPeopleOpsIdFactory,
  HrPeopleOpsIdPrefix,
  HrPeopleOpsRecord,
  LeaveBalance,
  LeaveRequest,
  LeaveRequestStatus,
  LeaveType,
  ModuleResult,
  Position,
  RecordAttendanceInput,
  RejectLeaveRequestInput,
  RequestLeaveInput,
  TenantContext
} from "./types";

export const hrPeopleOpsModule = {
  id: "hr-people-ops",
  version: "0.1.0"
} as const;
