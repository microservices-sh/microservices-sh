import { escapeHtml, formatDocumentDate, formatDocumentMoney } from "../document-export";

export interface InvoiceEmailInput {
  invoiceNumber: string;
  customerName: string;
  totalCents: number;
  outstandingCents: number;
  currency: string;
  dueAt?: string | null;
  paymentLinkUrl?: string | null;
  companyName?: string | null;
}

export function buildInvoiceEmail(input: InvoiceEmailInput): { subject: string; html: string; text: string } {
  const companyName = input.companyName || "Commerce Ops";
  const due = formatDocumentDate(input.dueAt);
  const total = formatDocumentMoney(input.totalCents, input.currency);
  const outstanding = formatDocumentMoney(input.outstandingCents, input.currency);
  const linkLine = input.paymentLinkUrl ? `Pay online: ${input.paymentLinkUrl}` : "Please contact us for payment instructions.";

  return {
    subject: `Invoice ${input.invoiceNumber} from ${companyName}`,
    html: `<p>Hello ${escapeHtml(input.customerName)},</p>
<p>Invoice <strong>${escapeHtml(input.invoiceNumber)}</strong> is ready.</p>
<ul>
  <li>Total: <strong>${escapeHtml(total)}</strong></li>
  <li>Outstanding: <strong>${escapeHtml(outstanding)}</strong></li>
  <li>Due: <strong>${escapeHtml(due)}</strong></li>
</ul>
${input.paymentLinkUrl ? `<p><a href="${escapeHtml(input.paymentLinkUrl)}">Pay this invoice online</a></p>` : ""}
<p>Thank you,<br>${escapeHtml(companyName)}</p>`,
    text: [
      `Hello ${input.customerName},`,
      "",
      `Invoice ${input.invoiceNumber} is ready.`,
      `Total: ${total}`,
      `Outstanding: ${outstanding}`,
      `Due: ${due}`,
      linkLine,
      "",
      `Thank you,`,
      companyName
    ].join("\n")
  };
}
