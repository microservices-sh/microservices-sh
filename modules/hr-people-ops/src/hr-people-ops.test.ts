import { describe, expect, it } from "vitest";
import { createHrPeopleOpsMemoryStore } from "./adapters/memory";
import { createHrPeopleOpsService, createSequentialHrPeopleOpsIdFactory } from "./service";
import type { ModuleResult, TenantContext } from "./types";

function service() {
  return createHrPeopleOpsService({
    store: createHrPeopleOpsMemoryStore(),
    createId: createSequentialHrPeopleOpsIdFactory(),
    config: { enabled: true, defaultLeaveYear: 2026 }
  });
}

function unwrap<T>(result: ModuleResult<T>): T {
  if (!result.ok || !result.data) throw new Error(result.error?.message ?? "Expected ok result");
  return result.data;
}

const ctx: TenantContext = {
  tenantId: "tenant_1",
  actorId: "user_1",
  now: "2026-01-01T00:00:00.000Z"
};

async function seedEmployee(hr = service()) {
  const department = unwrap(await hr.createDepartment(ctx, { name: "Operations", code: "OPS" }));
  const position = unwrap(await hr.createPosition(ctx, { title: "Operations Lead", code: "OPS_LEAD", departmentId: department.id, level: 3 }));
  const employee = unwrap(
    await hr.createEmployee(ctx, {
      employeeNumber: "E-100",
      firstName: "Avery",
      lastName: "Chen",
      email: "Avery@example.com",
      hireDate: "2026-01-01",
      departmentId: department.id,
      positionId: position.id
    })
  );
  return { hr, department, position, employee };
}

describe("hr-people-ops service", () => {
  it("creates departments, positions, employees, and snapshots", async () => {
    const { hr, department, position, employee } = await seedEmployee();

    expect(employee.email).toBe("avery@example.com");
    const snapshot = unwrap(await hr.getEmployeeSnapshot(ctx, employee.id));
    expect(snapshot.department?.id).toBe(department.id);
    expect(snapshot.position?.id).toBe(position.id);
  });

  it("approves leave requests and moves pending leave into used leave", async () => {
    const { hr, employee } = await seedEmployee();
    const annualLeave = unwrap(await hr.createLeaveType(ctx, { name: "Annual Leave", code: "AL", defaultHundredthsPerYear: 2000 }));
    unwrap(await hr.assignLeaveBalance(ctx, { employeeId: employee.id, leaveTypeId: annualLeave.id, allocatedHundredths: 2000, carriedOverHundredths: 100 }));

    const request = unwrap(
      await hr.requestLeave(ctx, {
        employeeId: employee.id,
        leaveTypeId: annualLeave.id,
        startDate: "2026-02-02",
        endDate: "2026-02-03",
        totalHundredths: 200,
        reason: "Family"
      })
    );
    expect(request.status).toBe("pending");

    const pendingSnapshot = unwrap(await hr.getEmployeeSnapshot(ctx, employee.id));
    expect(pendingSnapshot.leaveBalances[0]?.pendingHundredths).toBe(200);

    const approved = unwrap(await hr.approveLeaveRequest(ctx, { requestId: request.id }));
    expect(approved.status).toBe("approved");
    const approvedSnapshot = unwrap(await hr.getEmployeeSnapshot(ctx, employee.id));
    expect(approvedSnapshot.leaveBalances[0]?.pendingHundredths).toBe(0);
    expect(approvedSnapshot.leaveBalances[0]?.usedHundredths).toBe(200);
  });

  it("reverses rejected and cancelled leave, and upserts attendance", async () => {
    const { hr, employee } = await seedEmployee();
    const leaveType = unwrap(await hr.createLeaveType(ctx, { name: "Sick Leave", code: "SL", defaultHundredthsPerYear: 1000 }));
    unwrap(await hr.assignLeaveBalance(ctx, { employeeId: employee.id, leaveTypeId: leaveType.id, allocatedHundredths: 1000 }));

    const rejectedRequest = unwrap(await hr.requestLeave(ctx, { employeeId: employee.id, leaveTypeId: leaveType.id, startDate: "2026-03-01", endDate: "2026-03-01", totalHundredths: 100 }));
    unwrap(await hr.rejectLeaveRequest(ctx, { requestId: rejectedRequest.id, rejectionReason: "Coverage gap" }));
    const afterReject = unwrap(await hr.getEmployeeSnapshot(ctx, employee.id));
    expect(afterReject.leaveBalances[0]?.pendingHundredths).toBe(0);
    expect(afterReject.leaveBalances[0]?.usedHundredths).toBe(0);

    const approvedRequest = unwrap(await hr.requestLeave(ctx, { employeeId: employee.id, leaveTypeId: leaveType.id, startDate: "2026-04-01", endDate: "2026-04-01", totalHundredths: 50 }));
    unwrap(await hr.approveLeaveRequest(ctx, { requestId: approvedRequest.id }));
    unwrap(await hr.cancelLeaveRequest(ctx, { requestId: approvedRequest.id }));
    const afterCancel = unwrap(await hr.getEmployeeSnapshot(ctx, employee.id));
    expect(afterCancel.leaveBalances[0]?.usedHundredths).toBe(0);

    const attendance = unwrap(await hr.recordAttendance(ctx, { employeeId: employee.id, date: "2026-01-05", status: "present", workMinutes: 480 }));
    const updated = unwrap(await hr.recordAttendance(ctx, { employeeId: employee.id, date: "2026-01-05", status: "late", workMinutes: 450, notes: "Train delay" }));
    expect(updated.id).toBe(attendance.id);
    expect(updated.status).toBe("late");
    expect(updated.notes).toBe("Train delay");
  });
});
