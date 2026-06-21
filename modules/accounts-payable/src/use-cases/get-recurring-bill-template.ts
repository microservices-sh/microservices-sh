import { recurringBillTemplateIdentitySchema } from "../schemas";
import { err, ok, type AccountsPayableDeps } from "./shared";

export async function getRecurringBillTemplate(input: unknown, deps: AccountsPayableDeps) {
  const parsed = recurringBillTemplateIdentitySchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      "accounts-payable.INVALID_RECURRING_BILL_TEMPLATE_IDENTITY",
      "Recurring bill template identity is invalid.",
      deps,
      parsed.error.issues
    );
  }

  const template = await deps.accountsPayableStore.getRecurringBillTemplate(
    parsed.data.tenantId,
    parsed.data.templateId
  );
  if (!template) {
    return err(404, "accounts-payable.RECURRING_BILL_TEMPLATE_NOT_FOUND", "Recurring bill template not found.", deps);
  }

  return ok(200, { template }, deps);
}
