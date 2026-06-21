import type { AccountsReceivableService } from "@microservices-sh/accounts-receivable";
import type { Invoice } from "@microservices-sh/invoice";

type SyncResult = { ok: true; skipped?: boolean } | { ok: false; message: string };

function receivableStatus(invoice: Invoice): "open" | "paid" | "void" | null {
  if (invoice.status === "draft") return null;
  return invoice.status;
}

export async function syncInvoiceToReceivables(input: {
  accountsReceivableService: AccountsReceivableService;
  tenantId: string;
  actorId: string;
  invoice: Invoice;
}): Promise<SyncResult> {
  const status = receivableStatus(input.invoice);
  if (!status) return { ok: true, skipped: true };
  if (!input.invoice.number || !input.invoice.issuedAt || !input.invoice.dueAt) {
    return { ok: true, skipped: true };
  }

  const amountPaidCents = Math.max(0, Math.min(input.invoice.amountPaidCents, input.invoice.totalCents));
  const amountDueCents = status === "void" ? 0 : Math.max(0, input.invoice.totalCents - amountPaidCents);
  const result = await input.accountsReceivableService.upsertInvoiceSnapshot(
    { tenantId: input.tenantId, actorId: input.actorId, now: new Date().toISOString() },
    {
      id: input.invoice.id,
      customerId: input.invoice.customerId,
      invoiceNumber: input.invoice.number,
      issuedAt: input.invoice.issuedAt,
      dueDate: input.invoice.dueAt,
      totalCents: input.invoice.totalCents,
      amountPaidCents,
      amountDueCents,
      status
    }
  );

  if (!result.ok) return { ok: false, message: result.error?.message ?? "Could not sync the invoice receivable snapshot." };
  return { ok: true };
}
