import type { HrPeopleOpsStore } from "../ports";
import type { AttendanceRecord, Department, Employee, LeaveBalance, LeaveRequest, LeaveType, Position } from "../types";

export interface HrPeopleOpsMemoryStoreState {
  departments?: Department[];
  positions?: Position[];
  employees?: Employee[];
  leaveTypes?: LeaveType[];
  leaveBalances?: LeaveBalance[];
  leaveRequests?: LeaveRequest[];
  attendance?: AttendanceRecord[];
}

function copy<T>(value: T): T {
  return structuredClone(value);
}

function tenantCodeKey(tenantId: string, code: string): string {
  return `${tenantId}:${code.toUpperCase()}`;
}

function balanceKey(tenantId: string, employeeId: string, leaveTypeId: string, year: number): string {
  return `${tenantId}:${employeeId}:${leaveTypeId}:${year}`;
}

function attendanceKey(tenantId: string, employeeId: string, date: string): string {
  return `${tenantId}:${employeeId}:${date}`;
}

export function createHrPeopleOpsMemoryStore(initialState: HrPeopleOpsMemoryStoreState = {}): HrPeopleOpsStore {
  const departments = new Map<string, Department>();
  const departmentCodes = new Map<string, string>();
  const positions = new Map<string, Position>();
  const positionCodes = new Map<string, string>();
  const employees = new Map<string, Employee>();
  const employeeNumbers = new Map<string, string>();
  const employeeEmails = new Map<string, string>();
  const leaveTypes = new Map<string, LeaveType>();
  const leaveTypeCodes = new Map<string, string>();
  const leaveBalances = new Map<string, LeaveBalance>();
  const leaveRequests = new Map<string, LeaveRequest>();
  const attendance = new Map<string, AttendanceRecord>();

  for (const department of initialState.departments ?? []) {
    departments.set(department.id, copy(department));
    departmentCodes.set(tenantCodeKey(department.tenantId, department.code), department.id);
  }
  for (const position of initialState.positions ?? []) {
    positions.set(position.id, copy(position));
    positionCodes.set(tenantCodeKey(position.tenantId, position.code), position.id);
  }
  for (const employee of initialState.employees ?? []) {
    employees.set(employee.id, copy(employee));
    employeeNumbers.set(tenantCodeKey(employee.tenantId, employee.employeeNumber), employee.id);
    employeeEmails.set(tenantCodeKey(employee.tenantId, employee.email), employee.id);
  }
  for (const leaveType of initialState.leaveTypes ?? []) {
    leaveTypes.set(leaveType.id, copy(leaveType));
    leaveTypeCodes.set(tenantCodeKey(leaveType.tenantId, leaveType.code), leaveType.id);
  }
  for (const balance of initialState.leaveBalances ?? []) leaveBalances.set(balanceKey(balance.tenantId, balance.employeeId, balance.leaveTypeId, balance.year), copy(balance));
  for (const request of initialState.leaveRequests ?? []) leaveRequests.set(request.id, copy(request));
  for (const record of initialState.attendance ?? []) attendance.set(attendanceKey(record.tenantId, record.employeeId, record.date), copy(record));

  return {
    async getDepartment(tenantId, departmentId) {
      const department = departments.get(departmentId);
      return department?.tenantId === tenantId ? copy(department) : null;
    },
    async getDepartmentByCode(tenantId, code) {
      const id = departmentCodes.get(tenantCodeKey(tenantId, code));
      const department = id ? departments.get(id) : null;
      return department ? copy(department) : null;
    },
    async upsertDepartment(department) {
      const existing = departments.get(department.id);
      if (existing) departmentCodes.delete(tenantCodeKey(existing.tenantId, existing.code));
      departments.set(department.id, copy(department));
      departmentCodes.set(tenantCodeKey(department.tenantId, department.code), department.id);
    },
    async listDepartments(tenantId, includeInactive = false) {
      return [...departments.values()]
        .filter((department) => department.tenantId === tenantId && (includeInactive || department.isActive))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(copy);
    },

    async getPosition(tenantId, positionId) {
      const position = positions.get(positionId);
      return position?.tenantId === tenantId ? copy(position) : null;
    },
    async getPositionByCode(tenantId, code) {
      const id = positionCodes.get(tenantCodeKey(tenantId, code));
      const position = id ? positions.get(id) : null;
      return position ? copy(position) : null;
    },
    async upsertPosition(position) {
      const existing = positions.get(position.id);
      if (existing) positionCodes.delete(tenantCodeKey(existing.tenantId, existing.code));
      positions.set(position.id, copy(position));
      positionCodes.set(tenantCodeKey(position.tenantId, position.code), position.id);
    },
    async listPositions(tenantId, includeInactive = false) {
      return [...positions.values()]
        .filter((position) => position.tenantId === tenantId && (includeInactive || position.isActive))
        .sort((a, b) => a.title.localeCompare(b.title))
        .map(copy);
    },

    async getEmployee(tenantId, employeeId) {
      const employee = employees.get(employeeId);
      return employee?.tenantId === tenantId ? copy(employee) : null;
    },
    async getEmployeeByNumber(tenantId, employeeNumber) {
      const id = employeeNumbers.get(tenantCodeKey(tenantId, employeeNumber));
      const employee = id ? employees.get(id) : null;
      return employee ? copy(employee) : null;
    },
    async getEmployeeByEmail(tenantId, email) {
      const id = employeeEmails.get(tenantCodeKey(tenantId, email));
      const employee = id ? employees.get(id) : null;
      return employee ? copy(employee) : null;
    },
    async upsertEmployee(employee) {
      const existing = employees.get(employee.id);
      if (existing) {
        employeeNumbers.delete(tenantCodeKey(existing.tenantId, existing.employeeNumber));
        employeeEmails.delete(tenantCodeKey(existing.tenantId, existing.email));
      }
      employees.set(employee.id, copy(employee));
      employeeNumbers.set(tenantCodeKey(employee.tenantId, employee.employeeNumber), employee.id);
      employeeEmails.set(tenantCodeKey(employee.tenantId, employee.email), employee.id);
    },
    async listEmployees(tenantId, includeInactive = false) {
      return [...employees.values()]
        .filter((employee) => employee.tenantId === tenantId && (includeInactive || !["inactive", "terminated"].includes(employee.status)))
        .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName))
        .map(copy);
    },

    async getLeaveType(tenantId, leaveTypeId) {
      const leaveType = leaveTypes.get(leaveTypeId);
      return leaveType?.tenantId === tenantId ? copy(leaveType) : null;
    },
    async getLeaveTypeByCode(tenantId, code) {
      const id = leaveTypeCodes.get(tenantCodeKey(tenantId, code));
      const leaveType = id ? leaveTypes.get(id) : null;
      return leaveType ? copy(leaveType) : null;
    },
    async upsertLeaveType(leaveType) {
      const existing = leaveTypes.get(leaveType.id);
      if (existing) leaveTypeCodes.delete(tenantCodeKey(existing.tenantId, existing.code));
      leaveTypes.set(leaveType.id, copy(leaveType));
      leaveTypeCodes.set(tenantCodeKey(leaveType.tenantId, leaveType.code), leaveType.id);
    },
    async listLeaveTypes(tenantId, includeInactive = false) {
      return [...leaveTypes.values()]
        .filter((leaveType) => leaveType.tenantId === tenantId && (includeInactive || leaveType.isActive))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(copy);
    },

    async getLeaveBalance(tenantId, employeeId, leaveTypeId, year) {
      const balance = leaveBalances.get(balanceKey(tenantId, employeeId, leaveTypeId, year));
      return balance ? copy(balance) : null;
    },
    async upsertLeaveBalance(balance) {
      leaveBalances.set(balanceKey(balance.tenantId, balance.employeeId, balance.leaveTypeId, balance.year), copy(balance));
    },
    async listLeaveBalancesForEmployee(tenantId, employeeId) {
      return [...leaveBalances.values()]
        .filter((balance) => balance.tenantId === tenantId && balance.employeeId === employeeId)
        .sort((a, b) => b.year - a.year || a.leaveTypeId.localeCompare(b.leaveTypeId))
        .map(copy);
    },

    async insertLeaveRequest(request) {
      leaveRequests.set(request.id, copy(request));
    },
    async updateLeaveRequest(request) {
      leaveRequests.set(request.id, copy(request));
    },
    async getLeaveRequest(tenantId, requestId) {
      const request = leaveRequests.get(requestId);
      return request?.tenantId === tenantId ? copy(request) : null;
    },
    async listLeaveRequestsForEmployee(tenantId, employeeId, limit) {
      const rows = [...leaveRequests.values()]
        .filter((request) => request.tenantId === tenantId && request.employeeId === employeeId)
        .sort((a, b) => b.startDate.localeCompare(a.startDate));
      return rows.slice(0, limit ?? rows.length).map(copy);
    },

    async getAttendanceRecord(tenantId, employeeId, date) {
      const record = attendance.get(attendanceKey(tenantId, employeeId, date));
      return record ? copy(record) : null;
    },
    async upsertAttendanceRecord(record) {
      attendance.set(attendanceKey(record.tenantId, record.employeeId, record.date), copy(record));
    },
    async listAttendanceForEmployee(tenantId, employeeId, limit) {
      const rows = [...attendance.values()]
        .filter((record) => record.tenantId === tenantId && record.employeeId === employeeId)
        .sort((a, b) => b.date.localeCompare(a.date));
      return rows.slice(0, limit ?? rows.length).map(copy);
    }
  };
}
