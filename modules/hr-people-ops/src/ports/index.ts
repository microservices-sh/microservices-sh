import type { AttendanceRecord, Department, Employee, LeaveBalance, LeaveRequest, LeaveType, Position } from "../types";

export interface HrPeopleOpsStore {
  getDepartment(tenantId: string, departmentId: string): Promise<Department | null>;
  getDepartmentByCode(tenantId: string, code: string): Promise<Department | null>;
  upsertDepartment(department: Department): Promise<void>;
  listDepartments(tenantId: string, includeInactive?: boolean): Promise<Department[]>;

  getPosition(tenantId: string, positionId: string): Promise<Position | null>;
  getPositionByCode(tenantId: string, code: string): Promise<Position | null>;
  upsertPosition(position: Position): Promise<void>;
  listPositions(tenantId: string, includeInactive?: boolean): Promise<Position[]>;

  getEmployee(tenantId: string, employeeId: string): Promise<Employee | null>;
  getEmployeeByNumber(tenantId: string, employeeNumber: string): Promise<Employee | null>;
  getEmployeeByEmail(tenantId: string, email: string): Promise<Employee | null>;
  upsertEmployee(employee: Employee): Promise<void>;
  listEmployees(tenantId: string, includeInactive?: boolean): Promise<Employee[]>;

  getLeaveType(tenantId: string, leaveTypeId: string): Promise<LeaveType | null>;
  getLeaveTypeByCode(tenantId: string, code: string): Promise<LeaveType | null>;
  upsertLeaveType(leaveType: LeaveType): Promise<void>;
  listLeaveTypes(tenantId: string, includeInactive?: boolean): Promise<LeaveType[]>;

  getLeaveBalance(tenantId: string, employeeId: string, leaveTypeId: string, year: number): Promise<LeaveBalance | null>;
  upsertLeaveBalance(balance: LeaveBalance): Promise<void>;
  listLeaveBalancesForEmployee(tenantId: string, employeeId: string): Promise<LeaveBalance[]>;

  insertLeaveRequest(request: LeaveRequest): Promise<void>;
  updateLeaveRequest(request: LeaveRequest): Promise<void>;
  getLeaveRequest(tenantId: string, requestId: string): Promise<LeaveRequest | null>;
  listLeaveRequestsForEmployee(tenantId: string, employeeId: string, limit?: number): Promise<LeaveRequest[]>;

  getAttendanceRecord(tenantId: string, employeeId: string, date: string): Promise<AttendanceRecord | null>;
  upsertAttendanceRecord(record: AttendanceRecord): Promise<void>;
  listAttendanceForEmployee(tenantId: string, employeeId: string, limit?: number): Promise<AttendanceRecord[]>;
}
