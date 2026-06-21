import { fiscalPeriodIdentitySchema } from "../schemas";
import { err, ok, type AccountingDeps } from "./shared";

export async function getFiscalPeriod(input: unknown, deps: AccountingDeps) {
  const parsed = fiscalPeriodIdentitySchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "accounting-core.INVALID_FISCAL_PERIOD_IDENTITY", "Fiscal period lookup input is invalid.", parsed.error.issues);
  }

  const period = await deps.accountingCoreStore.getFiscalPeriod(parsed.data.tenantId, parsed.data.periodId);
  if (!period) return err(404, "accounting-core.FISCAL_PERIOD_NOT_FOUND", "Fiscal period not found.");

  return ok(200, { period });
}
