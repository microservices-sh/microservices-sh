import { updateRecurringBillTemplateStatusInputSchema } from "../schemas";
import { isoNow } from "../service";
import type { RecurringBillStatus } from "../types";
import { err, ok, type AccountsPayableDeps } from "./shared";

const terminalStatuses = new Set<RecurringBillStatus>(["cancelled", "completed"]);

function canTransition(from: RecurringBillStatus, to: RecurringBillStatus): boolean {
  if (from === to) return true;
  if (terminalStatuses.has(from)) return false;
  if (to === "active") return from === "paused";
  if (to === "paused") return from === "active";
  return to === "cancelled" || to === "completed";
}

export async function updateRecurringBillTemplateStatus(input: unknown, deps: AccountsPayableDeps) {
  const parsed = updateRecurringBillTemplateStatusInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      "accounts-payable.INVALID_RECURRING_BILL_TEMPLATE_STATUS_INPUT",
      "Recurring bill template status input is invalid.",
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

  if (!canTransition(template.status, parsed.data.status)) {
    return err(
      409,
      "accounts-payable.INVALID_RECURRING_BILL_TEMPLATE_STATUS_TRANSITION",
      `Cannot change a ${template.status} recurring bill template to ${parsed.data.status}.`,
      deps
    );
  }

  if (template.status === parsed.data.status) {
    return ok(200, { template, idempotent: true }, deps);
  }

  const updated = { ...template, status: parsed.data.status, updatedAt: isoNow(deps.now) };
  await deps.accountsPayableStore.updateRecurringBillTemplate(updated);
  await deps.accountsPayableStore.writeEvent({
    eventName: "accounts-payable.recurring_bill_template_status_updated",
    entityType: "accounts-payable",
    entityId: updated.id,
    tenantId: updated.tenantId,
    payload: { previousStatus: template.status, status: updated.status }
  });

  return ok(200, { template: updated, previousStatus: template.status }, deps);
}
