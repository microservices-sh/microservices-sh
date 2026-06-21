import { agingReportInputSchema } from "../schemas";
import { buildAgingReport, isoNow } from "../service";
import { err, ok, type AccountsPayableDeps } from "./shared";

export async function getAgingReport(input: unknown, deps: AccountsPayableDeps) {
  const parsed = agingReportInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "accounts-payable.INVALID_AGING_INPUT", "Aging report input is invalid.", deps, parsed.error.issues);
  }

  const asOfDate = parsed.data.asOfDate ?? isoNow(deps.now);
  const bills = (await deps.accountsPayableStore.listOpenBills(parsed.data.tenantId, parsed.data.vendorId)).filter(
    (bill) => bill.billDate <= asOfDate
  );
  return ok(200, { report: buildAgingReport({ tenantId: parsed.data.tenantId, asOfDate, bills }) }, deps);
}
