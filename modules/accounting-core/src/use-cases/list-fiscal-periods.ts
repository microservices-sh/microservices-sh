import { fiscalPeriodFilterSchema } from "../schemas";
import { err, ok, type AccountingDeps } from "./shared";

export async function listFiscalPeriods(input: unknown, deps: AccountingDeps) {
  const parsed = fiscalPeriodFilterSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "accounting-core.INVALID_FISCAL_PERIOD_FILTER", "Fiscal period filter is invalid.", parsed.error.issues);
  }

  const periods = await deps.accountingCoreStore.listFiscalPeriods(parsed.data);
  return ok(200, { periods });
}
