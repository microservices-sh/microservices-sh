import type { HrPeopleOpsStore } from "../ports";
import type {
  AttendanceRecord,
  AttendanceStatus,
  Department,
  Employee,
  EmploymentStatus,
  EmploymentType,
  LeaveBalance,
  LeaveRequest,
  LeaveRequestStatus,
  LeaveType,
  Position
} from "../types";

const DEPARTMENT_COLS = "id, tenant_id, name, code, description, manager_employee_id, parent_department_id, is_active, created_at, updated_at";
const POSITION_COLS = "id, tenant_id, title, code, description, department_id, level, is_active, created_at, updated_at";
const EMPLOYEE_COLS =
  "id, tenant_id, user_id, employee_number, first_name, last_name, email, phone, date_of_birth, hire_date, termination_date, department_id, position_id, manager_employee_id, status, employment_type, address, city, country, emergency_contact_name, emergency_contact_phone, notes, created_at, updated_at";
const LEAVE_TYPE_COLS = "id, tenant_id, name, code, description, default_hundredths_per_year, is_paid, requires_approval, is_active, created_at, updated_at";
const LEAVE_BALANCE_COLS = "id, tenant_id, employee_id, leave_type_id, year, allocated_hundredths, used_hundredths, pending_hundredths, carried_over_hundredths, created_at, updated_at";
const LEAVE_REQUEST_COLS = "id, tenant_id, employee_id, leave_type_id, start_date, end_date, total_hundredths, reason, status, approver_employee_id, approved_at, rejection_reason, created_at, updated_at";
const ATTENDANCE_COLS = "id, tenant_id, employee_id, date, clock_in, clock_out, status, work_minutes, overtime_minutes, notes, created_at, updated_at";

function bool(value: unknown): boolean {
  return Number(value ?? 0) === 1;
}

function nullable(value: unknown): string | null {
  return value == null ? null : String(value);
}

function toDepartment(row: Record<string, unknown>): Department {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    name: String(row.name),
    code: String(row.code),
    description: nullable(row.description),
    managerEmployeeId: nullable(row.manager_employee_id),
    parentDepartmentId: nullable(row.parent_department_id),
    isActive: bool(row.is_active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function toPosition(row: Record<string, unknown>): Position {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    title: String(row.title),
    code: String(row.code),
    description: nullable(row.description),
    departmentId: nullable(row.department_id),
    level: row.level == null ? null : Number(row.level),
    isActive: bool(row.is_active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function toEmployee(row: Record<string, unknown>): Employee {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    userId: nullable(row.user_id),
    employeeNumber: String(row.employee_number),
    firstName: String(row.first_name),
    lastName: String(row.last_name),
    email: String(row.email),
    phone: nullable(row.phone),
    dateOfBirth: nullable(row.date_of_birth),
    hireDate: String(row.hire_date),
    terminationDate: nullable(row.termination_date),
    departmentId: nullable(row.department_id),
    positionId: nullable(row.position_id),
    managerEmployeeId: nullable(row.manager_employee_id),
    status: String(row.status) as EmploymentStatus,
    employmentType: String(row.employment_type) as EmploymentType,
    address: nullable(row.address),
    city: nullable(row.city),
    country: nullable(row.country),
    emergencyContactName: nullable(row.emergency_contact_name),
    emergencyContactPhone: nullable(row.emergency_contact_phone),
    notes: nullable(row.notes),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function toLeaveType(row: Record<string, unknown>): LeaveType {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    name: String(row.name),
    code: String(row.code),
    description: nullable(row.description),
    defaultHundredthsPerYear: Number(row.default_hundredths_per_year ?? 0),
    isPaid: bool(row.is_paid),
    requiresApproval: bool(row.requires_approval),
    isActive: bool(row.is_active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function toLeaveBalance(row: Record<string, unknown>): LeaveBalance {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    employeeId: String(row.employee_id),
    leaveTypeId: String(row.leave_type_id),
    year: Number(row.year ?? 0),
    allocatedHundredths: Number(row.allocated_hundredths ?? 0),
    usedHundredths: Number(row.used_hundredths ?? 0),
    pendingHundredths: Number(row.pending_hundredths ?? 0),
    carriedOverHundredths: Number(row.carried_over_hundredths ?? 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function toLeaveRequest(row: Record<string, unknown>): LeaveRequest {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    employeeId: String(row.employee_id),
    leaveTypeId: String(row.leave_type_id),
    startDate: String(row.start_date),
    endDate: String(row.end_date),
    totalHundredths: Number(row.total_hundredths ?? 0),
    reason: nullable(row.reason),
    status: String(row.status) as LeaveRequestStatus,
    approverEmployeeId: nullable(row.approver_employee_id),
    approvedAt: nullable(row.approved_at),
    rejectionReason: nullable(row.rejection_reason),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function toAttendance(row: Record<string, unknown>): AttendanceRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    employeeId: String(row.employee_id),
    date: String(row.date),
    clockIn: nullable(row.clock_in),
    clockOut: nullable(row.clock_out),
    status: String(row.status) as AttendanceStatus,
    workMinutes: Number(row.work_minutes ?? 0),
    overtimeMinutes: Number(row.overtime_minutes ?? 0),
    notes: nullable(row.notes),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function createD1HrPeopleOpsStore(db: D1Database): HrPeopleOpsStore {
  return {
    async getDepartment(tenantId, departmentId) {
      const row = await db.prepare(`SELECT ${DEPARTMENT_COLS} FROM hr_departments WHERE tenant_id = ? AND id = ?`).bind(tenantId, departmentId).first<Record<string, unknown>>();
      return row ? toDepartment(row) : null;
    },
    async getDepartmentByCode(tenantId, code) {
      const row = await db.prepare(`SELECT ${DEPARTMENT_COLS} FROM hr_departments WHERE tenant_id = ? AND code = ?`).bind(tenantId, code).first<Record<string, unknown>>();
      return row ? toDepartment(row) : null;
    },
    async upsertDepartment(department) {
      await db.prepare(
        `INSERT INTO hr_departments (${DEPARTMENT_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(tenant_id, id) DO UPDATE SET name = excluded.name, code = excluded.code, description = excluded.description, manager_employee_id = excluded.manager_employee_id, parent_department_id = excluded.parent_department_id, is_active = excluded.is_active, updated_at = excluded.updated_at`
      )
        .bind(department.id, department.tenantId, department.name, department.code, department.description, department.managerEmployeeId, department.parentDepartmentId, department.isActive ? 1 : 0, department.createdAt, department.updatedAt)
        .run();
    },
    async listDepartments(tenantId, includeInactive = false) {
      const result = await db.prepare(`SELECT ${DEPARTMENT_COLS} FROM hr_departments WHERE tenant_id = ? ${includeInactive ? "" : "AND is_active = 1"} ORDER BY name ASC`).bind(tenantId).all<Record<string, unknown>>();
      return (result.results ?? []).map(toDepartment);
    },

    async getPosition(tenantId, positionId) {
      const row = await db.prepare(`SELECT ${POSITION_COLS} FROM hr_positions WHERE tenant_id = ? AND id = ?`).bind(tenantId, positionId).first<Record<string, unknown>>();
      return row ? toPosition(row) : null;
    },
    async getPositionByCode(tenantId, code) {
      const row = await db.prepare(`SELECT ${POSITION_COLS} FROM hr_positions WHERE tenant_id = ? AND code = ?`).bind(tenantId, code).first<Record<string, unknown>>();
      return row ? toPosition(row) : null;
    },
    async upsertPosition(position) {
      await db.prepare(
        `INSERT INTO hr_positions (${POSITION_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(tenant_id, id) DO UPDATE SET title = excluded.title, code = excluded.code, description = excluded.description, department_id = excluded.department_id, level = excluded.level, is_active = excluded.is_active, updated_at = excluded.updated_at`
      )
        .bind(position.id, position.tenantId, position.title, position.code, position.description, position.departmentId, position.level, position.isActive ? 1 : 0, position.createdAt, position.updatedAt)
        .run();
    },
    async listPositions(tenantId, includeInactive = false) {
      const result = await db.prepare(`SELECT ${POSITION_COLS} FROM hr_positions WHERE tenant_id = ? ${includeInactive ? "" : "AND is_active = 1"} ORDER BY title ASC`).bind(tenantId).all<Record<string, unknown>>();
      return (result.results ?? []).map(toPosition);
    },

    async getEmployee(tenantId, employeeId) {
      const row = await db.prepare(`SELECT ${EMPLOYEE_COLS} FROM hr_employees WHERE tenant_id = ? AND id = ?`).bind(tenantId, employeeId).first<Record<string, unknown>>();
      return row ? toEmployee(row) : null;
    },
    async getEmployeeByNumber(tenantId, employeeNumber) {
      const row = await db.prepare(`SELECT ${EMPLOYEE_COLS} FROM hr_employees WHERE tenant_id = ? AND employee_number = ?`).bind(tenantId, employeeNumber).first<Record<string, unknown>>();
      return row ? toEmployee(row) : null;
    },
    async getEmployeeByEmail(tenantId, email) {
      const row = await db.prepare(`SELECT ${EMPLOYEE_COLS} FROM hr_employees WHERE tenant_id = ? AND email = ?`).bind(tenantId, email).first<Record<string, unknown>>();
      return row ? toEmployee(row) : null;
    },
    async upsertEmployee(employee) {
      await db.prepare(
        `INSERT INTO hr_employees (${EMPLOYEE_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(tenant_id, id) DO UPDATE SET user_id = excluded.user_id, employee_number = excluded.employee_number, first_name = excluded.first_name, last_name = excluded.last_name, email = excluded.email, phone = excluded.phone, date_of_birth = excluded.date_of_birth, hire_date = excluded.hire_date, termination_date = excluded.termination_date, department_id = excluded.department_id, position_id = excluded.position_id, manager_employee_id = excluded.manager_employee_id, status = excluded.status, employment_type = excluded.employment_type, address = excluded.address, city = excluded.city, country = excluded.country, emergency_contact_name = excluded.emergency_contact_name, emergency_contact_phone = excluded.emergency_contact_phone, notes = excluded.notes, updated_at = excluded.updated_at`
      )
        .bind(employee.id, employee.tenantId, employee.userId, employee.employeeNumber, employee.firstName, employee.lastName, employee.email, employee.phone, employee.dateOfBirth, employee.hireDate, employee.terminationDate, employee.departmentId, employee.positionId, employee.managerEmployeeId, employee.status, employee.employmentType, employee.address, employee.city, employee.country, employee.emergencyContactName, employee.emergencyContactPhone, employee.notes, employee.createdAt, employee.updatedAt)
        .run();
    },
    async listEmployees(tenantId, includeInactive = false) {
      const result = await db
        .prepare(`SELECT ${EMPLOYEE_COLS} FROM hr_employees WHERE tenant_id = ? ${includeInactive ? "" : "AND status NOT IN ('inactive', 'terminated')"} ORDER BY last_name ASC, first_name ASC`)
        .bind(tenantId)
        .all<Record<string, unknown>>();
      return (result.results ?? []).map(toEmployee);
    },

    async getLeaveType(tenantId, leaveTypeId) {
      const row = await db.prepare(`SELECT ${LEAVE_TYPE_COLS} FROM hr_leave_types WHERE tenant_id = ? AND id = ?`).bind(tenantId, leaveTypeId).first<Record<string, unknown>>();
      return row ? toLeaveType(row) : null;
    },
    async getLeaveTypeByCode(tenantId, code) {
      const row = await db.prepare(`SELECT ${LEAVE_TYPE_COLS} FROM hr_leave_types WHERE tenant_id = ? AND code = ?`).bind(tenantId, code).first<Record<string, unknown>>();
      return row ? toLeaveType(row) : null;
    },
    async upsertLeaveType(leaveType) {
      await db.prepare(
        `INSERT INTO hr_leave_types (${LEAVE_TYPE_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(tenant_id, id) DO UPDATE SET name = excluded.name, code = excluded.code, description = excluded.description, default_hundredths_per_year = excluded.default_hundredths_per_year, is_paid = excluded.is_paid, requires_approval = excluded.requires_approval, is_active = excluded.is_active, updated_at = excluded.updated_at`
      )
        .bind(leaveType.id, leaveType.tenantId, leaveType.name, leaveType.code, leaveType.description, leaveType.defaultHundredthsPerYear, leaveType.isPaid ? 1 : 0, leaveType.requiresApproval ? 1 : 0, leaveType.isActive ? 1 : 0, leaveType.createdAt, leaveType.updatedAt)
        .run();
    },
    async listLeaveTypes(tenantId, includeInactive = false) {
      const result = await db.prepare(`SELECT ${LEAVE_TYPE_COLS} FROM hr_leave_types WHERE tenant_id = ? ${includeInactive ? "" : "AND is_active = 1"} ORDER BY name ASC`).bind(tenantId).all<Record<string, unknown>>();
      return (result.results ?? []).map(toLeaveType);
    },

    async getLeaveBalance(tenantId, employeeId, leaveTypeId, year) {
      const row = await db.prepare(`SELECT ${LEAVE_BALANCE_COLS} FROM hr_leave_balances WHERE tenant_id = ? AND employee_id = ? AND leave_type_id = ? AND year = ?`).bind(tenantId, employeeId, leaveTypeId, year).first<Record<string, unknown>>();
      return row ? toLeaveBalance(row) : null;
    },
    async upsertLeaveBalance(balance) {
      await db.prepare(
        `INSERT INTO hr_leave_balances (${LEAVE_BALANCE_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(tenant_id, employee_id, leave_type_id, year) DO UPDATE SET allocated_hundredths = excluded.allocated_hundredths, used_hundredths = excluded.used_hundredths, pending_hundredths = excluded.pending_hundredths, carried_over_hundredths = excluded.carried_over_hundredths, updated_at = excluded.updated_at`
      )
        .bind(balance.id, balance.tenantId, balance.employeeId, balance.leaveTypeId, balance.year, balance.allocatedHundredths, balance.usedHundredths, balance.pendingHundredths, balance.carriedOverHundredths, balance.createdAt, balance.updatedAt)
        .run();
    },
    async listLeaveBalancesForEmployee(tenantId, employeeId) {
      const result = await db.prepare(`SELECT ${LEAVE_BALANCE_COLS} FROM hr_leave_balances WHERE tenant_id = ? AND employee_id = ? ORDER BY year DESC, leave_type_id ASC`).bind(tenantId, employeeId).all<Record<string, unknown>>();
      return (result.results ?? []).map(toLeaveBalance);
    },

    async insertLeaveRequest(request) {
      await db.prepare(`INSERT INTO hr_leave_requests (${LEAVE_REQUEST_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(request.id, request.tenantId, request.employeeId, request.leaveTypeId, request.startDate, request.endDate, request.totalHundredths, request.reason, request.status, request.approverEmployeeId, request.approvedAt, request.rejectionReason, request.createdAt, request.updatedAt)
        .run();
    },
    async updateLeaveRequest(request) {
      await db.prepare("UPDATE hr_leave_requests SET status = ?, approver_employee_id = ?, approved_at = ?, rejection_reason = ?, updated_at = ? WHERE tenant_id = ? AND id = ?")
        .bind(request.status, request.approverEmployeeId, request.approvedAt, request.rejectionReason, request.updatedAt, request.tenantId, request.id)
        .run();
    },
    async getLeaveRequest(tenantId, requestId) {
      const row = await db.prepare(`SELECT ${LEAVE_REQUEST_COLS} FROM hr_leave_requests WHERE tenant_id = ? AND id = ?`).bind(tenantId, requestId).first<Record<string, unknown>>();
      return row ? toLeaveRequest(row) : null;
    },
    async listLeaveRequestsForEmployee(tenantId, employeeId, limit = 20) {
      const result = await db.prepare(`SELECT ${LEAVE_REQUEST_COLS} FROM hr_leave_requests WHERE tenant_id = ? AND employee_id = ? ORDER BY start_date DESC LIMIT ?`).bind(tenantId, employeeId, limit).all<Record<string, unknown>>();
      return (result.results ?? []).map(toLeaveRequest);
    },

    async getAttendanceRecord(tenantId, employeeId, date) {
      const row = await db.prepare(`SELECT ${ATTENDANCE_COLS} FROM hr_attendance_records WHERE tenant_id = ? AND employee_id = ? AND date = ?`).bind(tenantId, employeeId, date).first<Record<string, unknown>>();
      return row ? toAttendance(row) : null;
    },
    async upsertAttendanceRecord(record) {
      await db.prepare(
        `INSERT INTO hr_attendance_records (${ATTENDANCE_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(tenant_id, employee_id, date) DO UPDATE SET clock_in = excluded.clock_in, clock_out = excluded.clock_out, status = excluded.status, work_minutes = excluded.work_minutes, overtime_minutes = excluded.overtime_minutes, notes = excluded.notes, updated_at = excluded.updated_at`
      )
        .bind(record.id, record.tenantId, record.employeeId, record.date, record.clockIn, record.clockOut, record.status, record.workMinutes, record.overtimeMinutes, record.notes, record.createdAt, record.updatedAt)
        .run();
    },
    async listAttendanceForEmployee(tenantId, employeeId, limit = 20) {
      const result = await db.prepare(`SELECT ${ATTENDANCE_COLS} FROM hr_attendance_records WHERE tenant_id = ? AND employee_id = ? ORDER BY date DESC LIMIT ?`).bind(tenantId, employeeId, limit).all<Record<string, unknown>>();
      return (result.results ?? []).map(toAttendance);
    }
  };
}
