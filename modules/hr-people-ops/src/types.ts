export interface HrPeopleOpsConfig {
  enabled: boolean;
  defaultLeaveYear?: number;
}

export type HrPeopleOpsIdPrefix = "hrdept" | "hrpos" | "hremp" | "hrlt" | "hrbal" | "hrlr" | "hratt";
export type HrPeopleOpsIdFactory = (prefix: HrPeopleOpsIdPrefix) => string;

export type EmploymentStatus = "active" | "inactive" | "on_leave" | "terminated";
export type EmploymentType = "full_time" | "part_time" | "contract" | "intern";
export type LeaveRequestStatus = "pending" | "approved" | "rejected" | "cancelled";
export type AttendanceStatus = "present" | "absent" | "late" | "half_day" | "on_leave";

export interface TenantContext {
  tenantId: string;
  actorId?: string;
  now?: string;
}

export interface Department {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  description: string | null;
  managerEmployeeId: string | null;
  parentDepartmentId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Position {
  id: string;
  tenantId: string;
  title: string;
  code: string;
  description: string | null;
  departmentId: string | null;
  level: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  id: string;
  tenantId: string;
  userId: string | null;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  dateOfBirth: string | null;
  hireDate: string;
  terminationDate: string | null;
  departmentId: string | null;
  positionId: string | null;
  managerEmployeeId: string | null;
  status: EmploymentStatus;
  employmentType: EmploymentType;
  address: string | null;
  city: string | null;
  country: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveType {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  description: string | null;
  defaultHundredthsPerYear: number;
  isPaid: boolean;
  requiresApproval: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveBalance {
  id: string;
  tenantId: string;
  employeeId: string;
  leaveTypeId: string;
  year: number;
  allocatedHundredths: number;
  usedHundredths: number;
  pendingHundredths: number;
  carriedOverHundredths: number;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveRequest {
  id: string;
  tenantId: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  totalHundredths: number;
  reason: string | null;
  status: LeaveRequestStatus;
  approverEmployeeId: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceRecord {
  id: string;
  tenantId: string;
  employeeId: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  status: AttendanceStatus;
  workMinutes: number;
  overtimeMinutes: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeSnapshot {
  employee: Employee;
  department: Department | null;
  position: Position | null;
  leaveBalances: LeaveBalance[];
  leaveRequests: LeaveRequest[];
  attendance: AttendanceRecord[];
}

export interface CreateDepartmentInput {
  id?: string;
  name: string;
  code?: string;
  description?: string | null;
  managerEmployeeId?: string | null;
  parentDepartmentId?: string | null;
  isActive?: boolean;
}

export interface CreatePositionInput {
  id?: string;
  title: string;
  code?: string;
  description?: string | null;
  departmentId?: string | null;
  level?: number | null;
  isActive?: boolean;
}

export interface CreateEmployeeInput {
  id?: string;
  userId?: string | null;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  dateOfBirth?: string | null;
  hireDate: string;
  terminationDate?: string | null;
  departmentId?: string | null;
  positionId?: string | null;
  managerEmployeeId?: string | null;
  status?: EmploymentStatus;
  employmentType?: EmploymentType;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  notes?: string | null;
}

export interface CreateLeaveTypeInput {
  id?: string;
  name: string;
  code?: string;
  description?: string | null;
  defaultHundredthsPerYear: number;
  isPaid?: boolean;
  requiresApproval?: boolean;
  isActive?: boolean;
}

export interface AssignLeaveBalanceInput {
  id?: string;
  employeeId: string;
  leaveTypeId: string;
  year?: number;
  allocatedHundredths: number;
  carriedOverHundredths?: number;
}

export interface RequestLeaveInput {
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  totalHundredths: number;
  reason?: string | null;
}

export interface ApproveLeaveRequestInput {
  requestId: string;
  approverEmployeeId?: string | null;
}

export interface RejectLeaveRequestInput {
  requestId: string;
  rejectionReason: string;
}

export interface CancelLeaveRequestInput {
  requestId: string;
}

export interface RecordAttendanceInput {
  id?: string;
  employeeId: string;
  date: string;
  clockIn?: string | null;
  clockOut?: string | null;
  status: AttendanceStatus;
  workMinutes?: number;
  overtimeMinutes?: number;
  notes?: string | null;
}

export type HrPeopleOpsRecord = Employee;

export interface ModuleResult<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}
