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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "On receipt";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function buildInvoiceEmail(input: InvoiceEmailInput): { subject: string; html: string; text: string } {
  const companyName = input.companyName || "Accounting ERP";
  const due = formatDate(input.dueAt);
  const total = formatMoney(input.totalCents, input.currency);
  const outstanding = formatMoney(input.outstandingCents, input.currency);
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
      "Thank you,",
      companyName
    ].join("\n")
  };
}
