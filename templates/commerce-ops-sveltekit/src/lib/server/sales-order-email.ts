import type { SalesOrderWithLineItems } from "@microservices-sh/sales-order";
import { escapeHtml, formatDocumentDate, formatDocumentMoney } from "../document-export";

export interface SalesOrderEmailInput {
  order: SalesOrderWithLineItems;
  companyName?: string | null;
  message?: string | null;
}

export function buildSalesOrderEmail(input: SalesOrderEmailInput): { subject: string; html: string; text: string } {
  const companyName = input.companyName || "Commerce Ops";
  const orderNumber = input.order.orderNumber ?? input.order.id;
  const customerName = input.order.customerSnapshot?.displayName ?? "Customer";
  const total = formatDocumentMoney(input.order.totalCents, input.order.currency);
  const orderDate = formatDocumentDate(input.order.createdAt);
  const lines = input.order.lineItems
    .map(
      (line) =>
        `<tr><td>${escapeHtml(line.sku || "-")}</td><td>${escapeHtml(line.name)}</td><td>${escapeHtml(line.quantity)}</td><td>${escapeHtml(formatDocumentMoney(line.totalCents, input.order.currency))}</td></tr>`
    )
    .join("");

  const textLines = input.order.lineItems.map(
    (line) => `- ${line.sku ? `${line.sku} ` : ""}${line.name} x${line.quantity}: ${formatDocumentMoney(line.totalCents, input.order.currency)}`
  );

  return {
    subject: `Sales order ${orderNumber} from ${companyName}`,
    html: `<p>Hello ${escapeHtml(customerName)},</p>
<p>Sales order <strong>${escapeHtml(orderNumber)}</strong> is ready.</p>
${input.message ? `<p>${escapeHtml(input.message)}</p>` : ""}
<ul>
  <li>Total: <strong>${escapeHtml(total)}</strong></li>
  <li>Status: <strong>${escapeHtml(input.order.status)}</strong></li>
  <li>Order date: <strong>${escapeHtml(orderDate)}</strong></li>
</ul>
<table>
  <thead><tr><th align="left">SKU</th><th align="left">Item</th><th align="left">Qty</th><th align="left">Total</th></tr></thead>
  <tbody>${lines || `<tr><td colspan="4">No line items.</td></tr>`}</tbody>
</table>
<p>Thank you,<br>${escapeHtml(companyName)}</p>`,
    text: [
      `Hello ${customerName},`,
      "",
      `Sales order ${orderNumber} is ready.`,
      input.message || "",
      `Total: ${total}`,
      `Status: ${input.order.status}`,
      `Order date: ${orderDate}`,
      "",
      ...textLines,
      "",
      "Thank you,",
      companyName
    ]
      .filter((line, index, linesList) => line || linesList[index - 1])
      .join("\n")
  };
}
