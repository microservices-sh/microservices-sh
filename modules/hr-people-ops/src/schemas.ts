import { z } from "zod";

export const hrPeopleOpsConfigSchema = z.object({
  enabled: z.boolean().default(true),
  defaultLeaveYear: z.number().int().positive().optional()
});

export const employmentStatusSchema = z.enum(["active", "inactive", "on_leave", "terminated"]);
export const employmentTypeSchema = z.enum(["full_time", "part_time", "contract", "intern"]);
export const leaveRequestStatusSchema = z.enum(["pending", "approved", "rejected", "cancelled"]);
export const attendanceStatusSchema = z.enum(["present", "absent", "late", "half_day", "on_leave"]);

export const departmentSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  name: z.string().min(1),
  code: z.string().min(1),
  description: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

export const positionSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  title: z.string().min(1),
  code: z.string().min(1),
  departmentId: z.string().min(1).nullable(),
  isActive: z.boolean(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

export const employeeSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  employeeNumber: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  hireDate: z.string().min(1),
  departmentId: z.string().min(1).nullable(),
  positionId: z.string().min(1).nullable(),
  status: employmentStatusSchema,
  employmentType: employmentTypeSchema,
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

export const leaveTypeSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  name: z.string().min(1),
  code: z.string().min(1),
  defaultHundredthsPerYear: z.number().int().positive(),
  isPaid: z.boolean(),
  requiresApproval: z.boolean(),
  isActive: z.boolean()
});

export const leaveBalanceSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  employeeId: z.string().min(1),
  leaveTypeId: z.string().min(1),
  year: z.number().int().positive(),
  allocatedHundredths: z.number().int().nonnegative(),
  usedHundredths: z.number().int().nonnegative(),
  pendingHundredths: z.number().int().nonnegative(),
  carriedOverHundredths: z.number().int().nonnegative()
});

export const leaveRequestSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  employeeId: z.string().min(1),
  leaveTypeId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  totalHundredths: z.number().int().positive(),
  status: leaveRequestStatusSchema
});

export const attendanceRecordSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  employeeId: z.string().min(1),
  date: z.string().min(1),
  status: attendanceStatusSchema,
  workMinutes: z.number().int().nonnegative(),
  overtimeMinutes: z.number().int().nonnegative()
});

export const hrPeopleOpsRecordSchema = employeeSchema;
