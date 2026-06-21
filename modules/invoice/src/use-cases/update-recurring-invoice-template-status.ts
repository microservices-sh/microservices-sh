import { ok, err } from "@microservices-sh/connection-contract";
import { invoiceMeta } from "../meta";
import { updateRecurringInvoiceTemplateStatusInputSchema } from "../schemas";
import type { RecurringInvoiceStore } from "../ports";
import type { DomainEvent, RecurringInvoiceStatus } from "../types";

const terminalStatuses = new Set<RecurringInvoiceStatus>(["cancelled", "completed"]);

function canTransition(from: RecurringInvoiceStatus, to: RecurringInvoiceStatus): boolean {
  if (from === to) return true;
  if (terminalStatuses.has(from)) return false;
  if (to === "active") return from === "paused";
  if (to === "paused") return from === "active";
  return to === "cancelled" || to === "completed";
}

export async function updateRecurringInvoiceTemplateStatus(
  input: unknown,
  deps: { recurringInvoiceStore: RecurringInvoiceStore; now?: () => number; correlationId?: string }
) {
  const meta = invoiceMeta(deps);
  const parsed = updateRecurringInvoiceTemplateStatusInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      400,
      { code: "invoice.INVALID_RECURRING_TEMPLATE_STATUS_INPUT", message: "Recurring invoice status input is invalid.", issues: parsed.error.issues },
      meta
    );
  }

  const template = await deps.recurringInvoiceStore.getTemplate(parsed.data.tenantId, parsed.data.templateId);
  if (!template) {
    return err(404, { code: "invoice.RECURRING_TEMPLATE_NOT_FOUND", message: "Recurring invoice template not found." }, meta);
  }
  if (!canTransition(template.status, parsed.data.status)) {
    return err(
      409,
      {
        code: "invoice.INVALID_RECURRING_TEMPLATE_STATUS_TRANSITION",
        message: `Cannot change a ${template.status} recurring invoice template to ${parsed.data.status}.`
      },
      meta
    );
  }

  const nowIso = new Date(deps.now?.() ?? Date.now()).toISOString();
  const updated = { ...template, status: parsed.data.status, updatedAt: nowIso };
  await deps.recurringInvoiceStore.updateTemplate(updated);
  const event: DomainEvent = {
    name: "invoice.recurring_template_status_updated",
    correlationId: meta.correlationId,
    payload: { id: template.id, from: template.status, to: updated.status }
  };
  return ok(200, { template: updated, event }, meta);
}
