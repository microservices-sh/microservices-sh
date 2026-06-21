import { fiscalPeriodStatusUpdateSchema } from "../schemas";
import { isoNow } from "../service";
import { err, ok, type AccountingDeps } from "./shared";

export async function updateFiscalPeriodStatus(input: unknown, deps: AccountingDeps) {
  const parsed = fiscalPeriodStatusUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "accounting-core.INVALID_FISCAL_PERIOD_STATUS", "Fiscal period status update is invalid.", parsed.error.issues);
  }

  const period = await deps.accountingCoreStore.getFiscalPeriod(parsed.data.tenantId, parsed.data.periodId);
  if (!period) return err(404, "accounting-core.FISCAL_PERIOD_NOT_FOUND", "Fiscal period not found.");

  const now = isoNow(deps.now);
  const updated = {
    ...period,
    status: parsed.data.status,
    closedAt: parsed.data.status === "closed" ? period.closedAt ?? now : parsed.data.status === "locked" ? period.closedAt ?? now : null,
    lockedAt: parsed.data.status === "locked" ? period.lockedAt ?? now : null,
    updatedAt: now
  };

  await deps.accountingCoreStore.updateFiscalPeriod(updated);
  await deps.accountingCoreStore.writeEvent({
    eventName: "accounting-core.fiscal_period_status_changed",
    entityType: "fiscal_period",
    entityId: updated.id,
    tenantId: updated.tenantId,
    payload: { status: updated.status }
  });

  return ok(200, { period: updated });
}
