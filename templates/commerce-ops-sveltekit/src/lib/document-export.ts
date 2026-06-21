export interface DocumentParty {
  name: string | null;
  email?: string | null;
  phone?: string | null;
  billingAddress?: string | null;
  shippingAddress?: string | null;
  taxId?: string | null;
}

export interface DocumentRenderSettings {
  companyName?: string | null;
  companyEmail?: string | null;
  companyPhone?: string | null;
  companyAddress?: string | null;
  companyTaxId?: string | null;
  footer?: string | null;
}

export interface InvoiceDocumentLine {
  description: string;
  quantity: number;
  unitAmountCents: number;
  taxRateBps?: number | null;
  amountCents: number;
}

export interface InvoiceDocumentData {
  number: string;
  status: string;
  currency: string;
  customer: DocumentParty;
  issuedAt?: string | null;
  dueAt?: string | null;
  paidAt?: string | null;
  notes?: string | null;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  amountPaidCents?: number | null;
  lineItems: InvoiceDocumentLine[];
}

export interface SalesOrderDocumentLine {
  sku?: string | null;
  name: string;
  description?: string | null;
  quantity: number;
  unitPriceCents: number;
  subtotalCents: number;
  discountCents?: number | null;
  taxCents?: number | null;
  totalCents: number;
}

export interface SalesOrderDocumentData {
  orderNumber: string;
  status: string;
  currency: string;
  customer: DocumentParty;
  orderDate?: string | null;
  notes?: string | null;
  subtotalCents: number;
  discountCents?: number | null;
  taxCents: number;
  totalCents: number;
  lineItems: SalesOrderDocumentLine[];
}

export interface InvoiceLedgerCsvRow {
  number: string;
  customer: string;
  status: string;
  currency: string;
  totalCents: number;
}

export interface SalesOrderLedgerCsvRow {
  orderNumber: string | null;
  id: string;
  status: string;
  currency: string;
  customerSnapshot?: { displayName?: string | null } | null;
  lineItems: unknown[];
  totalCents: number;
  inventoryReservationId?: string | null;
  invoiceId?: string | null;
}

type CsvValue = string | number | boolean | null | undefined;

const UNSAFE_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;

export function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatDocumentDate(value: string | number | Date | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function formatDocumentMoney(cents: number | null | undefined, currency = "USD"): string {
  const amount = Number(cents ?? 0) / 100;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function csvAmount(cents: number | null | undefined): string {
  return (Number(cents ?? 0) / 100).toFixed(2);
}

function dateToken(value: string | number | Date | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function cleanFilenamePart(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(UNSAFE_FILENAME_CHARS, "_")
    .replace(/\s+/g, " ")
    .trim();
}

export function safeDocumentFilename(input: {
  prefix?: string | null;
  number?: string | null;
  customerName?: string | null;
  date?: string | number | Date | null;
  extension?: string | null;
}): string {
  const extension = cleanFilenamePart(input.extension || "csv").replace(/^\.+/, "") || "csv";
  const parts = [input.prefix, input.number, input.customerName, dateToken(input.date)]
    .map(cleanFilenamePart)
    .filter(Boolean);
  const base = parts.join(" - ").replace(/\.+$/, "") || "document";
  return `${base}.${extension}`;
}

function addressHtml(address: string | null | undefined): string {
  if (!address) return "";
  return address
    .split(/\r?\n/)
    .map((line) => escapeHtml(line.trim()))
    .filter(Boolean)
    .join("<br>");
}

function companyBlock(settings: DocumentRenderSettings): string {
  return `<div>
    <h1>${escapeHtml(settings.companyName || "Commerce Ops")}</h1>
    ${settings.companyAddress ? `<p>${escapeHtml(settings.companyAddress)}</p>` : ""}
    ${settings.companyPhone ? `<p>${escapeHtml(settings.companyPhone)}</p>` : ""}
    ${settings.companyEmail ? `<p>${escapeHtml(settings.companyEmail)}</p>` : ""}
    ${settings.companyTaxId ? `<p>Tax ID: ${escapeHtml(settings.companyTaxId)}</p>` : ""}
  </div>`;
}

function partyBlock(label: string, party: DocumentParty, addressKind: "billingAddress" | "shippingAddress" = "billingAddress"): string {
  const address = addressHtml(party[addressKind] || party.billingAddress || party.shippingAddress);
  return `<section>
    <p class="label">${escapeHtml(label)}</p>
    <p class="name">${escapeHtml(party.name || "Customer")}</p>
    ${party.email ? `<p class="line muted">${escapeHtml(party.email)}</p>` : ""}
    ${party.phone ? `<p class="line muted">${escapeHtml(party.phone)}</p>` : ""}
    ${party.taxId ? `<p class="line muted">Tax ID: ${escapeHtml(party.taxId)}</p>` : ""}
    ${address ? `<p class="line">${address}</p>` : ""}
  </section>`;
}

function commonHead(title: string): string {
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  @page { size: A4; margin: 15mm; }
  @media print {
    body { margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 20px;
    background: #fff;
    color: #111827;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 12px;
    line-height: 1.45;
  }
  .doc { max-width: 210mm; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; gap: 24px; padding: 28px 0 22px; border-bottom: 2px solid #111827; }
  h1 { margin: 0 0 4px; font-size: 20px; letter-spacing: 0; }
  h2 { margin: 0; font-size: 25px; letter-spacing: .04em; text-transform: uppercase; }
  p { margin: 2px 0; }
  .muted { color: #6b7280; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  .strong { font-weight: 700; color: #111827; }
  .status { display: inline-block; margin-top: 8px; padding: 4px 9px; border: 1px solid #d1d5db; border-radius: 999px; font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; padding: 28px 0; }
  .label { margin: 0 0 8px; color: #6b7280; font-size: 10px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
  .name { margin: 0 0 6px; font-size: 16px; font-weight: 800; }
  .line { margin: 2px 0; }
  .notes { margin: 0 0 24px; padding: 14px 16px; border: 1px solid #d1d5db; background: #f9fafb; border-radius: 6px; }
  .notes p:last-child { white-space: pre-wrap; }
  table { width: 100%; border-collapse: collapse; }
  th { padding: 12px 8px; border-bottom: 2px solid #111827; text-align: left; color: #4b5563; font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
  td { padding: 13px 8px; border-top: 1px solid #e5e7eb; vertical-align: top; }
  tbody tr:first-child td { border-top: 0; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .center { text-align: center; }
  .sku { width: 120px; color: #4b5563; font-weight: 700; white-space: nowrap; }
  .totals { display: flex; justify-content: flex-end; padding-top: 22px; }
  .totals table { width: 300px; }
  .totals td { padding: 8px 0; border-top: 1px solid #e5e7eb; }
  .totals tr:first-child td { border-top: 0; }
  .totals .grand td { border-top: 2px solid #111827; font-size: 14px; font-weight: 800; }
  .footer { margin-top: 42px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #6b7280; text-align: center; }
</style>
<script>window.addEventListener("load",()=>{window.focus();setTimeout(()=>window.print(),100);});</script>`;
}

function totalsRows(rows: Array<[string, number | null | undefined]>, currency: string): string {
  return `<section class="totals">
    <table aria-label="Document totals"><tbody>
      ${rows
        .map(([label, cents], index) => `<tr class="${index === rows.length - 1 ? "grand" : ""}">
          <td>${escapeHtml(label)}</td>
          <td class="num">${formatDocumentMoney(cents, currency)}</td>
        </tr>`)
        .join("")}
    </tbody></table>
  </section>`;
}

export function generateInvoicePrintHtml(data: InvoiceDocumentData, settings: DocumentRenderSettings = {}): string {
  const rows =
    data.lineItems
      .map((item) => `<tr>
        <td>${escapeHtml(item.description)}</td>
        <td class="center mono">${escapeHtml(item.quantity)}</td>
        <td class="num mono">${formatDocumentMoney(item.unitAmountCents, data.currency)}</td>
        <td class="num mono">${((item.taxRateBps ?? 0) / 100).toFixed(2)}%</td>
        <td class="num mono">${formatDocumentMoney(item.amountCents, data.currency)}</td>
      </tr>`)
      .join("") || `<tr><td colspan="5" class="muted">No invoice line items.</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>${commonHead(`Invoice - ${data.number}`)}</head>
<body>
  <main class="doc">
    <section class="header">
      ${companyBlock(settings)}
      <div style="text-align:right">
        <h2>Invoice</h2>
        <p class="mono strong">${escapeHtml(data.number)}</p>
        <span class="status">${escapeHtml(data.status)}</span>
      </div>
    </section>

    <section class="grid">
      ${partyBlock("Bill To", data.customer)}
      <section style="text-align:right">
        <p class="label">Invoice Details</p>
        <p>Issued: <span class="mono strong">${escapeHtml(formatDocumentDate(data.issuedAt))}</span></p>
        <p>Due: <span class="mono strong">${escapeHtml(formatDocumentDate(data.dueAt))}</span></p>
        ${data.paidAt ? `<p>Paid: <span class="mono strong">${escapeHtml(formatDocumentDate(data.paidAt))}</span></p>` : ""}
      </section>
    </section>

    <table>
      <thead><tr><th>Description</th><th class="center">Qty</th><th class="num">Unit</th><th class="num">Tax</th><th class="num">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>

    ${totalsRows(
      [
        ["Subtotal", data.subtotalCents],
        ["Tax", data.taxCents],
        ["Paid", data.amountPaidCents ?? 0],
        ["Total", data.totalCents]
      ],
      data.currency
    )}

    ${data.notes ? `<section class="notes"><p class="label">Notes</p><p>${escapeHtml(data.notes)}</p></section>` : ""}
    ${settings.footer ? `<section class="footer">${escapeHtml(settings.footer)}</section>` : ""}
  </main>
</body>
</html>`;
}

export function generateSalesOrderPrintHtml(data: SalesOrderDocumentData, settings: DocumentRenderSettings = {}): string {
  const rows =
    data.lineItems
      .map((item) => `<tr>
        <td class="sku mono">${escapeHtml(item.sku || "-")}</td>
        <td><span class="strong">${escapeHtml(item.name)}</span>${item.description ? `<br><span class="muted">${escapeHtml(item.description)}</span>` : ""}</td>
        <td class="center mono">${escapeHtml(item.quantity)}</td>
        <td class="num mono">${formatDocumentMoney(item.unitPriceCents, data.currency)}</td>
        <td class="num mono">${formatDocumentMoney(item.discountCents ?? 0, data.currency)}</td>
        <td class="num mono">${formatDocumentMoney(item.taxCents ?? 0, data.currency)}</td>
        <td class="num mono">${formatDocumentMoney(item.totalCents, data.currency)}</td>
      </tr>`)
      .join("") || `<tr><td colspan="7" class="muted">No sales order line items.</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>${commonHead(`Sales Order - ${data.orderNumber}`)}</head>
<body>
  <main class="doc">
    <section class="header">
      ${companyBlock(settings)}
      <div style="text-align:right">
        <h2>Sales Order</h2>
        <p class="mono strong">${escapeHtml(data.orderNumber)}</p>
        <span class="status">${escapeHtml(data.status)}</span>
      </div>
    </section>

    <section class="grid">
      ${partyBlock("Customer", data.customer, "shippingAddress")}
      <section style="text-align:right">
        <p class="label">Order Details</p>
        <p>Order date: <span class="mono strong">${escapeHtml(formatDocumentDate(data.orderDate))}</span></p>
      </section>
    </section>

    <table>
      <thead><tr><th class="sku">SKU</th><th>Item</th><th class="center">Qty</th><th class="num">Unit</th><th class="num">Discount</th><th class="num">Tax</th><th class="num">Total</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>

    ${totalsRows(
      [
        ["Subtotal", data.subtotalCents],
        ["Discount", data.discountCents ?? 0],
        ["Tax", data.taxCents],
        ["Total", data.totalCents]
      ],
      data.currency
    )}

    ${data.notes ? `<section class="notes"><p class="label">Notes</p><p>${escapeHtml(data.notes)}</p></section>` : ""}
    ${settings.footer ? `<section class="footer">${escapeHtml(settings.footer)}</section>` : ""}
  </main>
</body>
</html>`;
}

function escapeCsvValue(value: CsvValue): string {
  if (value == null) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function generateCsv(headers: string[], rows: CsvValue[][]): string {
  return [headers, ...rows].map((row) => row.map(escapeCsvValue).join(",")).join("\r\n");
}

export function csvWithBom(csv: string): string {
  return `\ufeff${csv}`;
}

export function generateInvoiceLedgerCsv(rows: InvoiceLedgerCsvRow[]): string {
  return generateCsv(
    ["Invoice", "Customer", "Status", "Total", "Currency"],
    rows.map((row) => [row.number, row.customer, row.status, csvAmount(row.totalCents), row.currency])
  );
}

export function generateInvoiceLineItemsCsv(data: InvoiceDocumentData): string {
  return generateCsv(
    ["Invoice", "Description", "Quantity", "Unit price", "Tax rate", "Amount", "Currency"],
    data.lineItems.map((line) => [
      data.number,
      line.description,
      line.quantity,
      csvAmount(line.unitAmountCents),
      `${((line.taxRateBps ?? 0) / 100).toFixed(2)}%`,
      csvAmount(line.amountCents),
      data.currency
    ])
  );
}

export function generateSalesOrderLedgerCsv(rows: SalesOrderLedgerCsvRow[]): string {
  return generateCsv(
    ["Order", "Customer", "Status", "Lines", "Total", "Currency", "Reservation", "Invoice"],
    rows.map((row) => [
      row.orderNumber ?? row.id,
      row.customerSnapshot?.displayName ?? "Walk-in customer",
      row.status,
      row.lineItems.length,
      csvAmount(row.totalCents),
      row.currency,
      row.inventoryReservationId ?? "",
      row.invoiceId ?? ""
    ])
  );
}

export function generateSalesOrderLineItemsCsv(data: SalesOrderDocumentData): string {
  return generateCsv(
    ["Order", "SKU", "Item", "Description", "Quantity", "Unit price", "Discount", "Tax", "Total", "Currency"],
    data.lineItems.map((line) => [
      data.orderNumber,
      line.sku ?? "",
      line.name,
      line.description ?? "",
      line.quantity,
      csvAmount(line.unitPriceCents),
      csvAmount(line.discountCents ?? 0),
      csvAmount(line.taxCents ?? 0),
      csvAmount(line.totalCents),
      data.currency
    ])
  );
}

export function downloadTextFile(filename: string, content: string, type = "text/plain;charset=utf-8"): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadCsv(filename: string, csvContent: string): void {
  downloadTextFile(filename.endsWith(".csv") ? filename : `${filename}.csv`, csvWithBom(csvContent), "text/csv;charset=utf-8");
}

export function printDocumentHtml(html: string, blockedMessage = "Please allow pop-ups to print this document."): void {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (!win) {
    alert(blockedMessage);
    URL.revokeObjectURL(url);
    return;
  }
  win.opener = null;
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
