import { fiscalPeriodTransitionSchema } from "../schemas";
import { err, type AccountingDeps } from "./shared";
import { transitionFiscalPeriodStatus } from "./update-fiscal-period-status";

export async function closeFiscalPeriod(input: unknown, deps: AccountingDeps) {
  const parsed = fiscalPeriodTransitionSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "accounting-core.INVALID_FISCAL_PERIOD_TRANSITION_INPUT", "Fiscal period close input is invalid.", parsed.error.issues);
  }

  return transitionFiscalPeriodStatus({ ...parsed.data, status: "closed" }, deps);
}
