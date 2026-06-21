import { fiscalPeriodStatusUpdateSchema } from "../schemas";
import { isoNow } from "../service";
import type { FiscalPeriod, FiscalPeriodStatus } from "../types";
import { err, ok, type AccountingDeps } from "./shared";

function canTransition(from: FiscalPeriodStatus, to: FiscalPeriodStatus): boolean {
  if (from === "open") return to === "closed";
  if (from === "closed") return to === "open" || to === "locked";
  return false;
}

function applyTransition(period: FiscalPeriod, status: FiscalPeriodStatus, now: string): FiscalPeriod {
  if (status === "open") {
    return { ...period, status, closedAt: null, lockedAt: null, updatedAt: now };
  }
  if (status === "closed") {
    return { ...period, status, closedAt: period.closedAt ?? now, lockedAt: null, updatedAt: now };
  }
  return { ...period, status, closedAt: period.closedAt ?? now, lockedAt: now, updatedAt: now };
}

export async function transitionFiscalPeriodStatus(
  input: { tenantId: string; periodId: string; status: FiscalPeriodStatus; actorId?: string | null },
  deps: AccountingDeps
) {
  const period = await deps.accountingCoreStore.getFiscalPeriod(input.tenantId, input.periodId);
  if (!period) return err(404, "accounting-core.FISCAL_PERIOD_NOT_FOUND", "Fiscal period not found.");
  if (!canTransition(period.status, input.status)) {
    return err(
      409,
      "accounting-core.INVALID_FISCAL_PERIOD_TRANSITION",
      `Cannot change fiscal period status from ${period.status} to ${input.status}.`
    );
  }

  const now = isoNow(deps.now);
  const updated = applyTransition(period, input.status, now);

  await deps.accountingCoreStore.updateFiscalPeriod(updated);
  await deps.accountingCoreStore.writeEvent({
    eventName: "accounting-core.fiscal_period_status_changed",
    entityType: "fiscal_period",
    entityId: updated.id,
    tenantId: updated.tenantId,
    payload: { previousStatus: period.status, status: updated.status, actorId: input.actorId ?? null }
  });

  return ok(200, { period: updated });
}

export async function updateFiscalPeriodStatus(input: unknown, deps: AccountingDeps) {
  const parsed = fiscalPeriodStatusUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "accounting-core.INVALID_FISCAL_PERIOD_STATUS", "Fiscal period status update is invalid.", parsed.error.issues);
  }

  return transitionFiscalPeriodStatus(parsed.data, deps);
}
