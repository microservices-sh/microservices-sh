import type { HrPeopleOpsStore } from "../ports";
import type {
  ApproveLeaveRequestInput,
  AssignLeaveBalanceInput,
  AttendanceRecord,
  CancelLeaveRequestInput,
  CreateDepartmentInput,
  CreateEmployeeInput,
  CreateLeaveTypeInput,
  CreatePositionInput,
  Department,
  Employee,
  EmployeeSnapshot,
  HrPeopleOpsConfig,
  HrPeopleOpsIdFactory,
  HrPeopleOpsIdPrefix,
  LeaveBalance,
  LeaveRequest,
  LeaveType,
  ModuleResult,
  Position,
  RecordAttendanceInput,
  RejectLeaveRequestInput,
  RequestLeaveInput,
  TenantContext
} from "../types";

export interface HrPeopleOpsServiceDeps {
  store: HrPeopleOpsStore;
  createId?: HrPeopleOpsIdFactory;
  config?: HrPeopleOpsConfig;
}

export interface HrPeopleOpsService {
  createDepartment(ctx: TenantContext, input: CreateDepartmentInput): Promise<ModuleResult<Department>>;
  createPosition(ctx: TenantContext, input: CreatePositionInput): Promise<ModuleResult<Position>>;
  createEmployee(ctx: TenantContext, input: CreateEmployeeInput): Promise<ModuleResult<Employee>>;
  createLeaveType(ctx: TenantContext, input: CreateLeaveTypeInput): Promise<ModuleResult<LeaveType>>;
  assignLeaveBalance(ctx: TenantContext, input: AssignLeaveBalanceInput): Promise<ModuleResult<LeaveBalance>>;
  requestLeave(ctx: TenantContext, input: RequestLeaveInput): Promise<ModuleResult<LeaveRequest>>;
  approveLeaveRequest(ctx: TenantContext, input: ApproveLeaveRequestInput): Promise<ModuleResult<LeaveRequest>>;
  rejectLeaveRequest(ctx: TenantContext, input: RejectLeaveRequestInput): Promise<ModuleResult<LeaveRequest>>;
  cancelLeaveRequest(ctx: TenantContext, input: CancelLeaveRequestInput): Promise<ModuleResult<LeaveRequest>>;
  recordAttendance(ctx: TenantContext, input: RecordAttendanceInput): Promise<ModuleResult<AttendanceRecord>>;
  getEmployeeSnapshot(ctx: TenantContext, employeeId: string): Promise<ModuleResult<EmployeeSnapshot>>;
}

function ok<T>(data: T): ModuleResult<T> {
  return { ok: true, data };
}

function fail<T>(code: string, message: string): ModuleResult<T> {
  return { ok: false, error: { code, message } };
}

function failFrom<T>(result: ModuleResult<unknown>): ModuleResult<T> {
  return fail(result.error?.code ?? "operation_failed", result.error?.message ?? "Operation failed.");
}

function now(ctx: TenantContext): string {
  return ctx.now ?? new Date().toISOString();
}

function id(prefix: string, sequence: number): string {
  return `${prefix}_${sequence.toString().padStart(6, "0")}`;
}

export function createSequentialHrPeopleOpsIdFactory(): HrPeopleOpsIdFactory {
  const sequences: Record<HrPeopleOpsIdPrefix, number> = {
    hrdept: 0,
    hrpos: 0,
    hremp: 0,
    hrlt: 0,
    hrbal: 0,
    hrlr: 0,
    hratt: 0
  };
  return (prefix) => id(prefix, ++sequences[prefix]);
}

function defaultId(prefix: HrPeopleOpsIdPrefix): string {
  const uuid = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID?.();
  const randomId = uuid ? uuid.replaceAll("-", "") : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${randomId.slice(0, 24)}`;
}

function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function requiredText(value: string | undefined, code: string, message: string): ModuleResult<string> {
  const cleaned = cleanText(value);
  return cleaned ? ok(cleaned) : fail(code, message);
}

function cleanCode(value: string | undefined, fallback: string): string {
  const source = cleanText(value) ?? fallback;
  return source
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function cleanEmail(value: string): string {
  return value.trim().toLowerCase();
}

function nonNegativeInteger(value: number | null | undefined): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : -1;
}

function positiveHundredths(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function leaveYear(ctx: TenantContext, configuredYear?: number, inputYear?: number): number {
  if (Number.isInteger(inputYear) && inputYear) return inputYear;
  if (Number.isInteger(configuredYear) && configuredYear) return configuredYear;
  return new Date(now(ctx)).getUTCFullYear();
}

function yearFromDate(value: string): number {
  return new Date(`${value}T00:00:00.000Z`).getUTCFullYear();
}

function availableHundredths(balance: LeaveBalance): number {
  return balance.allocatedHundredths + balance.carriedOverHundredths - balance.usedHundredths - balance.pendingHundredths;
}

async function ensureEmployee(store: HrPeopleOpsStore, ctx: TenantContext, employeeId: string): Promise<ModuleResult<Employee>> {
  const employee = await store.getEmployee(ctx.tenantId, employeeId);
  return employee ? ok(employee) : fail("employee_not_found", "Employee was not found.");
}

async function ensureLeaveBalance(store: HrPeopleOpsStore, ctx: TenantContext, request: LeaveRequest): Promise<ModuleResult<LeaveBalance>> {
  const balance = await store.getLeaveBalance(ctx.tenantId, request.employeeId, request.leaveTypeId, yearFromDate(request.startDate));
  return balance ? ok(balance) : fail("leave_balance_not_found", "Leave balance was not found for the request year.");
}

export function createHrPeopleOpsService(deps: HrPeopleOpsServiceDeps): HrPeopleOpsService {
  const createId = deps.createId ?? defaultId;
  const configuredYear = deps.config?.defaultLeaveYear;

  return {
    async createDepartment(ctx, input) {
      const name = requiredText(input.name, "department_name_required", "Department name is required.");
      if (!name.ok || !name.data) return failFrom<Department>(name);
      const code = cleanCode(input.code, name.data);
      if (!code) return fail("department_code_required", "Department code is required.");
      if (await deps.store.getDepartmentByCode(ctx.tenantId, code)) return fail("department_code_exists", "Department code already exists.");
      if (input.managerEmployeeId && !(await deps.store.getEmployee(ctx.tenantId, input.managerEmployeeId))) return fail("manager_not_found", "Department manager employee was not found.");
      if (input.parentDepartmentId && !(await deps.store.getDepartment(ctx.tenantId, input.parentDepartmentId))) return fail("parent_department_not_found", "Parent department was not found.");
      const timestamp = now(ctx);
      const department: Department = {
        id: input.id?.trim() || createId("hrdept"),
        tenantId: ctx.tenantId,
        name: name.data,
        code,
        description: cleanText(input.description),
        managerEmployeeId: cleanText(input.managerEmployeeId),
        parentDepartmentId: cleanText(input.parentDepartmentId),
        isActive: input.isActive ?? true,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      await deps.store.upsertDepartment(department);
      return ok(department);
    },

    async createPosition(ctx, input) {
      const title = requiredText(input.title, "position_title_required", "Position title is required.");
      if (!title.ok || !title.data) return failFrom<Position>(title);
      const code = cleanCode(input.code, title.data);
      if (!code) return fail("position_code_required", "Position code is required.");
      if (await deps.store.getPositionByCode(ctx.tenantId, code)) return fail("position_code_exists", "Position code already exists.");
      const departmentId = cleanText(input.departmentId);
      if (departmentId && !(await deps.store.getDepartment(ctx.tenantId, departmentId))) return fail("department_not_found", "Position department was not found.");
      const level = input.level == null ? null : nonNegativeInteger(input.level);
      if (level === -1) return fail("position_level_invalid", "Position level must be a non-negative integer.");
      const timestamp = now(ctx);
      const position: Position = {
        id: input.id?.trim() || createId("hrpos"),
        tenantId: ctx.tenantId,
        title: title.data,
        code,
        description: cleanText(input.description),
        departmentId,
        level,
        isActive: input.isActive ?? true,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      await deps.store.upsertPosition(position);
      return ok(position);
    },

    async createEmployee(ctx, input) {
      const employeeNumber = requiredText(input.employeeNumber, "employee_number_required", "Employee number is required.");
      if (!employeeNumber.ok || !employeeNumber.data) return failFrom<Employee>(employeeNumber);
      const firstName = requiredText(input.firstName, "first_name_required", "Employee first name is required.");
      if (!firstName.ok || !firstName.data) return failFrom<Employee>(firstName);
      const lastName = requiredText(input.lastName, "last_name_required", "Employee last name is required.");
      if (!lastName.ok || !lastName.data) return failFrom<Employee>(lastName);
      const hireDate = requiredText(input.hireDate, "hire_date_required", "Employee hire date is required.");
      if (!hireDate.ok || !hireDate.data) return failFrom<Employee>(hireDate);
      const email = cleanEmail(input.email);
      if (!email || !email.includes("@")) return fail("email_invalid", "Employee email is required.");
      if (await deps.store.getEmployeeByNumber(ctx.tenantId, employeeNumber.data)) return fail("employee_number_exists", "Employee number already exists.");
      if (await deps.store.getEmployeeByEmail(ctx.tenantId, email)) return fail("employee_email_exists", "Employee email already exists.");
      const departmentId = cleanText(input.departmentId);
      const positionId = cleanText(input.positionId);
      const managerEmployeeId = cleanText(input.managerEmployeeId);
      if (departmentId && !(await deps.store.getDepartment(ctx.tenantId, departmentId))) return fail("department_not_found", "Employee department was not found.");
      if (positionId && !(await deps.store.getPosition(ctx.tenantId, positionId))) return fail("position_not_found", "Employee position was not found.");
      if (managerEmployeeId && !(await deps.store.getEmployee(ctx.tenantId, managerEmployeeId))) return fail("manager_not_found", "Employee manager was not found.");
      const timestamp = now(ctx);
      const employee: Employee = {
        id: input.id?.trim() || createId("hremp"),
        tenantId: ctx.tenantId,
        userId: cleanText(input.userId),
        employeeNumber: employeeNumber.data,
        firstName: firstName.data,
        lastName: lastName.data,
        email,
        phone: cleanText(input.phone),
        dateOfBirth: cleanText(input.dateOfBirth),
        hireDate: hireDate.data,
        terminationDate: cleanText(input.terminationDate),
        departmentId,
        positionId,
        managerEmployeeId,
        status: input.status ?? "active",
        employmentType: input.employmentType ?? "full_time",
        address: cleanText(input.address),
        city: cleanText(input.city),
        country: cleanText(input.country),
        emergencyContactName: cleanText(input.emergencyContactName),
        emergencyContactPhone: cleanText(input.emergencyContactPhone),
        notes: cleanText(input.notes),
        createdAt: timestamp,
        updatedAt: timestamp
      };
      await deps.store.upsertEmployee(employee);
      return ok(employee);
    },

    async createLeaveType(ctx, input) {
      const name = requiredText(input.name, "leave_type_name_required", "Leave type name is required.");
      if (!name.ok || !name.data) return failFrom<LeaveType>(name);
      const code = cleanCode(input.code, name.data);
      if (!code) return fail("leave_type_code_required", "Leave type code is required.");
      if (!positiveHundredths(input.defaultHundredthsPerYear)) return fail("default_leave_required", "Leave type default allowance must be a positive hundredths-of-day integer.");
      if (await deps.store.getLeaveTypeByCode(ctx.tenantId, code)) return fail("leave_type_code_exists", "Leave type code already exists.");
      const timestamp = now(ctx);
      const leaveType: LeaveType = {
        id: input.id?.trim() || createId("hrlt"),
        tenantId: ctx.tenantId,
        name: name.data,
        code,
        description: cleanText(input.description),
        defaultHundredthsPerYear: input.defaultHundredthsPerYear,
        isPaid: input.isPaid ?? true,
        requiresApproval: input.requiresApproval ?? true,
        isActive: input.isActive ?? true,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      await deps.store.upsertLeaveType(leaveType);
      return ok(leaveType);
    },

    async assignLeaveBalance(ctx, input) {
      const employee = await ensureEmployee(deps.store, ctx, input.employeeId);
      if (!employee.ok) return failFrom<LeaveBalance>(employee);
      if (!(await deps.store.getLeaveType(ctx.tenantId, input.leaveTypeId))) return fail("leave_type_not_found", "Leave type was not found.");
      if (!positiveHundredths(input.allocatedHundredths)) return fail("allocated_leave_required", "Allocated leave must be a positive hundredths-of-day integer.");
      const year = leaveYear(ctx, configuredYear, input.year);
      const existing = await deps.store.getLeaveBalance(ctx.tenantId, input.employeeId, input.leaveTypeId, year);
      const timestamp = now(ctx);
      const balance: LeaveBalance = {
        id: existing?.id ?? input.id?.trim() ?? createId("hrbal"),
        tenantId: ctx.tenantId,
        employeeId: input.employeeId,
        leaveTypeId: input.leaveTypeId,
        year,
        allocatedHundredths: input.allocatedHundredths,
        usedHundredths: existing?.usedHundredths ?? 0,
        pendingHundredths: existing?.pendingHundredths ?? 0,
        carriedOverHundredths: input.carriedOverHundredths ?? existing?.carriedOverHundredths ?? 0,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp
      };
      await deps.store.upsertLeaveBalance(balance);
      return ok(balance);
    },

    async requestLeave(ctx, input) {
      const employee = await ensureEmployee(deps.store, ctx, input.employeeId);
      if (!employee.ok) return failFrom<LeaveRequest>(employee);
      const leaveType = await deps.store.getLeaveType(ctx.tenantId, input.leaveTypeId);
      if (!leaveType || !leaveType.isActive) return fail("leave_type_not_found", "Active leave type was not found.");
      if (!positiveHundredths(input.totalHundredths)) return fail("leave_total_required", "Leave request requires a positive hundredths-of-day total.");
      const startDate = requiredText(input.startDate, "start_date_required", "Leave request start date is required.");
      if (!startDate.ok || !startDate.data) return failFrom<LeaveRequest>(startDate);
      const endDate = requiredText(input.endDate, "end_date_required", "Leave request end date is required.");
      if (!endDate.ok || !endDate.data) return failFrom<LeaveRequest>(endDate);
      if (endDate.data < startDate.data) return fail("date_range_invalid", "Leave request end date must be on or after the start date.");
      const year = leaveYear(ctx, configuredYear, yearFromDate(startDate.data));
      const balance = await deps.store.getLeaveBalance(ctx.tenantId, input.employeeId, input.leaveTypeId, year);
      if (!balance) return fail("leave_balance_not_found", "Leave balance was not found for the request year.");
      if (availableHundredths(balance) < input.totalHundredths) return fail("leave_balance_insufficient", "Leave balance is insufficient for this request.");
      const timestamp = now(ctx);
      const status = leaveType.requiresApproval ? "pending" : "approved";
      const updatedBalance: LeaveBalance = leaveType.requiresApproval
        ? { ...balance, pendingHundredths: balance.pendingHundredths + input.totalHundredths, updatedAt: timestamp }
        : { ...balance, usedHundredths: balance.usedHundredths + input.totalHundredths, updatedAt: timestamp };
      const request: LeaveRequest = {
        id: createId("hrlr"),
        tenantId: ctx.tenantId,
        employeeId: input.employeeId,
        leaveTypeId: input.leaveTypeId,
        startDate: startDate.data,
        endDate: endDate.data,
        totalHundredths: input.totalHundredths,
        reason: cleanText(input.reason),
        status,
        approverEmployeeId: null,
        approvedAt: status === "approved" ? timestamp : null,
        rejectionReason: null,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      await deps.store.upsertLeaveBalance(updatedBalance);
      await deps.store.insertLeaveRequest(request);
      return ok(request);
    },

    async approveLeaveRequest(ctx, input) {
      const request = await deps.store.getLeaveRequest(ctx.tenantId, input.requestId);
      if (!request) return fail("leave_request_not_found", "Leave request was not found.");
      if (request.status !== "pending") return fail("leave_request_not_pending", "Only pending leave requests can be approved.");
      const approverEmployeeId = cleanText(input.approverEmployeeId);
      if (approverEmployeeId && !(await deps.store.getEmployee(ctx.tenantId, approverEmployeeId))) return fail("approver_not_found", "Approver employee was not found.");
      const balance = await ensureLeaveBalance(deps.store, ctx, request);
      if (!balance.ok || !balance.data) return failFrom<LeaveRequest>(balance);
      const timestamp = now(ctx);
      const updatedRequest: LeaveRequest = { ...request, status: "approved", approverEmployeeId, approvedAt: timestamp, updatedAt: timestamp };
      const updatedBalance: LeaveBalance = {
        ...balance.data,
        pendingHundredths: Math.max(0, balance.data.pendingHundredths - request.totalHundredths),
        usedHundredths: balance.data.usedHundredths + request.totalHundredths,
        updatedAt: timestamp
      };
      await deps.store.upsertLeaveBalance(updatedBalance);
      await deps.store.updateLeaveRequest(updatedRequest);
      return ok(updatedRequest);
    },

    async rejectLeaveRequest(ctx, input) {
      const request = await deps.store.getLeaveRequest(ctx.tenantId, input.requestId);
      if (!request) return fail("leave_request_not_found", "Leave request was not found.");
      if (request.status !== "pending") return fail("leave_request_not_pending", "Only pending leave requests can be rejected.");
      const reason = cleanText(input.rejectionReason);
      if (!reason) return fail("rejection_reason_required", "Leave rejection reason is required.");
      const balance = await ensureLeaveBalance(deps.store, ctx, request);
      if (!balance.ok || !balance.data) return failFrom<LeaveRequest>(balance);
      const timestamp = now(ctx);
      const updatedRequest: LeaveRequest = { ...request, status: "rejected", rejectionReason: reason, updatedAt: timestamp };
      const updatedBalance: LeaveBalance = {
        ...balance.data,
        pendingHundredths: Math.max(0, balance.data.pendingHundredths - request.totalHundredths),
        updatedAt: timestamp
      };
      await deps.store.upsertLeaveBalance(updatedBalance);
      await deps.store.updateLeaveRequest(updatedRequest);
      return ok(updatedRequest);
    },

    async cancelLeaveRequest(ctx, input) {
      const request = await deps.store.getLeaveRequest(ctx.tenantId, input.requestId);
      if (!request) return fail("leave_request_not_found", "Leave request was not found.");
      if (!["pending", "approved"].includes(request.status)) return fail("leave_request_not_cancellable", "Only pending or approved leave requests can be cancelled.");
      const balance = await ensureLeaveBalance(deps.store, ctx, request);
      if (!balance.ok || !balance.data) return failFrom<LeaveRequest>(balance);
      const timestamp = now(ctx);
      const updatedRequest: LeaveRequest = { ...request, status: "cancelled", updatedAt: timestamp };
      const updatedBalance: LeaveBalance =
        request.status === "pending"
          ? { ...balance.data, pendingHundredths: Math.max(0, balance.data.pendingHundredths - request.totalHundredths), updatedAt: timestamp }
          : { ...balance.data, usedHundredths: Math.max(0, balance.data.usedHundredths - request.totalHundredths), updatedAt: timestamp };
      await deps.store.upsertLeaveBalance(updatedBalance);
      await deps.store.updateLeaveRequest(updatedRequest);
      return ok(updatedRequest);
    },

    async recordAttendance(ctx, input) {
      const employee = await ensureEmployee(deps.store, ctx, input.employeeId);
      if (!employee.ok) return failFrom<AttendanceRecord>(employee);
      const date = requiredText(input.date, "attendance_date_required", "Attendance date is required.");
      if (!date.ok || !date.data) return failFrom<AttendanceRecord>(date);
      const existing = await deps.store.getAttendanceRecord(ctx.tenantId, input.employeeId, date.data);
      const workMinutes = nonNegativeInteger(input.workMinutes ?? 0);
      const overtimeMinutes = nonNegativeInteger(input.overtimeMinutes ?? 0);
      if (workMinutes === -1 || overtimeMinutes === -1) return fail("attendance_minutes_invalid", "Attendance minutes must be non-negative integers.");
      const timestamp = now(ctx);
      const record: AttendanceRecord = {
        id: existing?.id ?? input.id?.trim() ?? createId("hratt"),
        tenantId: ctx.tenantId,
        employeeId: input.employeeId,
        date: date.data,
        clockIn: cleanText(input.clockIn),
        clockOut: cleanText(input.clockOut),
        status: input.status,
        workMinutes,
        overtimeMinutes,
        notes: cleanText(input.notes),
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp
      };
      await deps.store.upsertAttendanceRecord(record);
      return ok(record);
    },

    async getEmployeeSnapshot(ctx, employeeId) {
      const employee = await deps.store.getEmployee(ctx.tenantId, employeeId);
      if (!employee) return fail("employee_not_found", "Employee was not found.");
      const department = employee.departmentId ? await deps.store.getDepartment(ctx.tenantId, employee.departmentId) : null;
      const position = employee.positionId ? await deps.store.getPosition(ctx.tenantId, employee.positionId) : null;
      const leaveBalances = await deps.store.listLeaveBalancesForEmployee(ctx.tenantId, employee.id);
      const leaveRequests = await deps.store.listLeaveRequestsForEmployee(ctx.tenantId, employee.id, 10);
      const attendance = await deps.store.listAttendanceForEmployee(ctx.tenantId, employee.id, 10);
      return ok({ employee, department, position, leaveBalances, leaveRequests, attendance });
    }
  };
}

export function getHrPeopleOpsModuleStatus() {
  return { id: "hr-people-ops", status: "draft" } as const;
}
