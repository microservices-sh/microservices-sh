import { listRecurringBillTemplatesInputSchema } from "../schemas";
import { err, ok, type AccountsPayableDeps } from "./shared";

export async function listRecurringBillTemplates(input: unknown, deps: AccountsPayableDeps) {
  const parsed = listRecurringBillTemplatesInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      "accounts-payable.INVALID_RECURRING_BILL_TEMPLATE_FILTER",
      "Recurring bill template filter is invalid.",
      deps,
      parsed.error.issues
    );
  }

  const templates = await deps.accountsPayableStore.listRecurringBillTemplates(parsed.data);
  return ok(200, { templates, count: templates.length }, deps);
}
