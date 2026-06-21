import { fiscalPeriodInputSchema } from "../schemas";
import { accountingId, isoNow } from "../service";
import type { FiscalPeriod } from "../types";
import { err, hooks, ok, type AccountingDeps } from "./shared";

export async function createFiscalPeriod(input: unknown, deps: AccountingDeps) {
  const filtered = await hooks(deps).beforeFiscalPeriodCreate(input);
  const parsed = fiscalPeriodInputSchema.safeParse(filtered);
  if (!parsed.success) {
    return err(400, "accounting-core.INVALID_FISCAL_PERIOD_INPUT", "Fiscal period input is invalid.", parsed.error.issues);
  }
  if (parsed.data.startsOn > parsed.data.endsOn) {
    return err(400, "accounting-core.INVALID_FISCAL_PERIOD_RANGE", "Fiscal period start date must be on or before end date.");
  }

  const now = isoNow(deps.now);
  const period: FiscalPeriod = {
    id: accountingId("per"),
    tenantId: parsed.data.tenantId,
    name: parsed.data.name.trim(),
    startsOn: parsed.data.startsOn,
    endsOn: parsed.data.endsOn,
    status: parsed.data.status,
    closedAt: parsed.data.status === "closed" ? now : null,
    lockedAt: parsed.data.status === "locked" ? now : null,
    createdAt: now,
    updatedAt: now
  };

  await deps.accountingCoreStore.insertFiscalPeriod(period);
  await deps.accountingCoreStore.writeEvent({
    eventName: "accounting-core.fiscal_period_created",
    entityType: "fiscal_period",
    entityId: period.id,
    tenantId: period.tenantId,
    payload: { name: period.name, status: period.status }
  });

  return ok(201, { period });
}
