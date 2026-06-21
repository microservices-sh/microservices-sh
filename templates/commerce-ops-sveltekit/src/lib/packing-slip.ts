export interface ShipmentPrintItem {
  sku: string | null;
  description: string;
  quantity: number;
}

export interface ShipmentPrintData {
  shipmentId: string;
  shipmentNumber: string | null;
  status: string;
  carrier: string | null;
  trackingNumber: string | null;
  notes: string | null;
  createdAt: string;
  orderNumber: string | null;
  orderStatus: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  shippingAddress: string | null;
  orderNotes: string | null;
  items: ShipmentPrintItem[];
}

interface PickListItem {
  sku: string;
  description: string;
  quantity: number;
}

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function displayDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function displayId(data: ShipmentPrintData): string {
  return data.orderNumber ?? data.shipmentNumber ?? data.shipmentId;
}

function addressHtml(address: string | null): string {
  if (!address) return "";
  return address
    .split(/\r?\n/)
    .map((line) => escapeHtml(line.trim()))
    .filter(Boolean)
    .join("<br>");
}

function commonHead(title: string): string {
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  @page { size: A4; margin: 15mm; }
  @media print {
    body { margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page-break { break-before: page; }
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
  .header {
    display: flex;
    justify-content: space-between;
    gap: 24px;
    align-items: flex-start;
    padding: 28px 0 22px;
    border-bottom: 2px solid #111827;
  }
  h1 { margin: 0; font-size: 25px; letter-spacing: .04em; text-transform: uppercase; }
  .muted { color: #6b7280; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  .strong { font-weight: 700; color: #111827; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; padding: 28px 0; }
  .label { margin: 0 0 8px; color: #6b7280; font-size: 10px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
  .name { margin: 0 0 6px; font-size: 16px; font-weight: 800; }
  .line { margin: 2px 0; }
  .notes { margin: 0 0 24px; padding: 14px 16px; border: 1px solid #d1d5db; background: #f9fafb; border-radius: 6px; }
  .notes p { margin: 0; white-space: pre-wrap; }
  table { width: 100%; border-collapse: collapse; }
  th {
    padding: 12px 0;
    border-bottom: 2px solid #111827;
    text-align: left;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: .08em;
    text-transform: uppercase;
  }
  td { padding: 13px 0; border-top: 1px solid #e5e7eb; vertical-align: top; }
  tbody tr:first-child td { border-top: 0; }
  .sku { width: 120px; color: #4b5563; font-weight: 700; white-space: nowrap; }
  .qty { width: 84px; text-align: center; font-size: 16px; font-weight: 800; }
  .check { width: 76px; text-align: center; }
  .box { display: inline-block; width: 20px; height: 20px; border: 2px solid #9ca3af; border-radius: 4px; }
  .footer { display: flex; justify-content: space-between; gap: 40px; padding-top: 42px; }
  .signature { width: 240px; border-top: 1px solid #9ca3af; padding-top: 8px; }
  .signature span { color: #6b7280; font-size: 9px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; }
  .autoprint { display: none; }
</style>
<script>window.addEventListener("load",()=>{window.focus();setTimeout(()=>window.print(),100);});</script>`;
}

function renderRows(items: ShipmentPrintItem[]): string {
  if (items.length === 0) {
    return `<tr><td colspan="4" class="muted">No shipment items.</td></tr>`;
  }
  return items
    .map((item) => `<tr>
      <td class="sku mono">${escapeHtml(item.sku || "-")}</td>
      <td><span class="strong">${escapeHtml(item.description)}</span></td>
      <td class="qty mono">${escapeHtml(item.quantity)}</td>
      <td class="check"><span class="box"></span></td>
    </tr>`)
    .join("");
}

export function generateShipmentPackingSlipHtml(data: ShipmentPrintData): string {
  const shippingAddress = addressHtml(data.shippingAddress);
  const notes = data.notes || data.orderNotes || "";
  return `<!DOCTYPE html>
<html lang="en">
<head>${commonHead(`Packing Slip - ${displayId(data)}`)}</head>
<body>
  <main class="doc">
    <section class="header">
      <div>
        <h1>Packing Slip</h1>
        <p class="muted">Order <span class="mono strong">#${escapeHtml(displayId(data))}</span></p>
      </div>
      <div style="text-align:right">
        <p class="label">Date</p>
        <p class="line strong">${escapeHtml(displayDate(data.createdAt))}</p>
      </div>
    </section>

    <section class="grid">
      <div>
        <p class="label">Ship To</p>
        <p class="name">${escapeHtml(data.customerName || "Valued Customer")}</p>
        ${shippingAddress ? `<p class="line">${shippingAddress}</p>` : `<p class="line muted">No shipping address provided</p>`}
        ${data.customerEmail ? `<p class="line muted">${escapeHtml(data.customerEmail)}</p>` : ""}
        ${data.customerPhone ? `<p class="line muted">${escapeHtml(data.customerPhone)}</p>` : ""}
      </div>
      <div>
        <p class="label">Shipment Info</p>
        <p class="line">Shipment: <span class="mono strong">${escapeHtml(data.shipmentNumber ?? data.shipmentId)}</span></p>
        ${data.orderStatus ? `<p class="line">Order status: <span class="strong">${escapeHtml(data.orderStatus)}</span></p>` : ""}
        <p class="line">Shipment status: <span class="strong">${escapeHtml(data.status)}</span></p>
        ${data.carrier ? `<p class="line">Carrier: <span class="strong">${escapeHtml(data.carrier)}</span></p>` : ""}
        ${data.trackingNumber ? `<p class="line">Tracking: <span class="mono strong">${escapeHtml(data.trackingNumber)}</span></p>` : ""}
      </div>
    </section>

    ${notes ? `<section class="notes"><p class="label">Remarks</p><p>${escapeHtml(notes)}</p></section>` : ""}

    <table>
      <thead><tr><th class="sku">SKU</th><th>Item</th><th class="qty">Qty</th><th class="check">Check</th></tr></thead>
      <tbody>${renderRows(data.items)}</tbody>
    </table>

    <section class="footer">
      <div class="signature"><span>Packed By</span></div>
      <div class="signature"><span>Date</span></div>
    </section>
  </main>
</body>
</html>`;
}

function aggregatePickList(items: ShipmentPrintItem[]): PickListItem[] {
  const byKey = new Map<string, PickListItem>();
  for (const item of items) {
    const sku = item.sku?.trim() || "NO-SKU";
    const description = item.description.trim() || "Shipment item";
    const key = `${sku}\n${description}`;
    const existing = byKey.get(key);
    if (existing) existing.quantity += item.quantity;
    else byKey.set(key, { sku, description, quantity: item.quantity });
  }
  return [...byKey.values()].sort((a, b) => a.sku.localeCompare(b.sku) || a.description.localeCompare(b.description));
}

export function generateShipmentPickListHtml(data: ShipmentPrintData): string {
  const rows = aggregatePickList(data.items)
    .map((item) => `<tr>
      <td class="sku mono">${escapeHtml(item.sku)}</td>
      <td><span class="strong">${escapeHtml(item.description)}</span></td>
      <td class="qty mono">${escapeHtml(item.quantity)}</td>
      <td class="check"><span class="box"></span></td>
    </tr>`)
    .join("") || `<tr><td colspan="4" class="muted">No shipment items.</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>${commonHead(`Pick List - ${data.shipmentNumber ?? data.shipmentId}`)}</head>
<body>
  <main class="doc">
    <section class="header">
      <div>
        <h1>Pick List</h1>
        <p class="muted">Shipment <span class="mono strong">#${escapeHtml(data.shipmentNumber ?? data.shipmentId)}</span></p>
      </div>
      <div style="text-align:right">
        <p class="label">Date</p>
        <p class="line strong">${escapeHtml(displayDate(data.createdAt))}</p>
        <p class="line muted">${escapeHtml(data.items.length)} shipment lines</p>
      </div>
    </section>
    <table>
      <thead><tr><th class="sku">SKU</th><th>Product</th><th class="qty">Qty</th><th class="check">Check</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <section class="footer">
      <div class="signature"><span>Picked By</span></div>
      <div class="signature"><span>Date</span></div>
    </section>
  </main>
</body>
</html>`;
}

function printHtml(html: string): void {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (!win) {
    alert("Please allow pop-ups to print shipment documents.");
    URL.revokeObjectURL(url);
    return;
  }
  win.opener = null;
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function printShipmentPackingSlip(data: ShipmentPrintData): void {
  printHtml(generateShipmentPackingSlipHtml(data));
}

export function printShipmentPickList(data: ShipmentPrintData): void {
  printHtml(generateShipmentPickListHtml(data));
}
