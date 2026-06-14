import type { Invoice } from "./types";

// Customization seam: inspect/adjust an invoice just before it is issued (number
// assigned, totals frozen). Return null to abort the issue. Default pass-through.
export async function beforeInvoiceIssue(invoice: Invoice): Promise<Invoice | null> {
  return invoice;
}

// Customization seam: react to issue (e.g. render a PDF via file-media, enqueue a
// send via email + jobs-workflows). Default no-op.
export async function onInvoiceIssued(_invoice: Invoice): Promise<void> {
  return;
}

// Customization seam: react when an invoice becomes fully paid (e.g. receipt
// email, unlock access). Default no-op.
export async function onInvoicePaid(_invoice: Invoice): Promise<void> {
  return;
}
