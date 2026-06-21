import { describe, expect, it } from "vitest";

import {
  csvWithBom,
  escapeHtml,
  formatDocumentDate,
  formatDocumentMoney,
  generateCsv,
  generateInvoiceLineItemsCsv,
  generateInvoicePrintHtml,
  generateSalesOrderPrintHtml,
  safeDocumentFilename,
  type InvoiceDocumentData,
  type SalesOrderDocumentData
} from "../../templates/commerce-ops-sveltekit/src/lib/document-export.ts";

const invoice: InvoiceDocumentData = {
  number: "INV-100<script>",
  status: "open",
  currency: "USD",
  customer: {
    name: "Acme <script>alert(1)</script>",
    email: "buyer@example.com",
    phone: null,
    billingAddress: "1 Main St\nSuite <2>"
  },
  issuedAt: "2026-06-21T12:00:00.000Z",
  dueAt: "2026-07-05T12:00:00.000Z",
  notes: "Deliver before 5pm & confirm.",
  subtotalCents: 10_000,
  taxCents: 875,
  totalCents: 10_875,
  amountPaidCents: 0,
  lineItems: [
    {
      description: 'Discovery, setup, and "launch"',
      quantity: 2,
      unitAmountCents: 5_000,
      taxRateBps: 875,
      amountCents: 10_000
    }
  ]
};

describe("commerce document export helpers", () => {
  it("escapes document HTML and formats money/dates deterministically", () => {
    expect(escapeHtml(`<tag attr="x">O'Hara & Co</tag>`)).toBe("&lt;tag attr=&quot;x&quot;&gt;O&#39;Hara &amp; Co&lt;/tag&gt;");
    expect(formatDocumentMoney(12_345, "USD")).toBe("$123.45");
    expect(formatDocumentDate("2026-06-21T12:00:00.000Z")).toBe("Jun 21, 2026");

    const html = generateInvoicePrintHtml(invoice, { companyName: "StackSuite" });

    expect(html).toContain("StackSuite");
    expect(html).toContain("INV-100&lt;script&gt;");
    expect(html).toContain("Acme &lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("1 Main St<br>Suite &lt;2&gt;");
    expect(html).toContain("$108.75");
    expect(html).not.toContain("Acme <script>alert");
  });

  it("renders sales orders with escaped address text, discounts, tax, and totals", () => {
    const order: SalesOrderDocumentData = {
      orderNumber: "SO-900",
      status: "confirmed",
      currency: "USD",
      customer: {
        name: "Retail Buyer",
        email: "buyer@example.com",
        shippingAddress: "Dock 3\nBay <A>"
      },
      orderDate: "2026-06-21T00:00:00.000Z",
      notes: "Ship together.",
      subtotalCents: 1_000,
      discountCents: 100,
      taxCents: 200,
      totalCents: 1_100,
      lineItems: [
        {
          sku: "KIT-1",
          name: "Starter Kit",
          description: "Bundle <retail>",
          quantity: 1,
          unitPriceCents: 1_000,
          subtotalCents: 1_000,
          discountCents: 100,
          taxCents: 200,
          totalCents: 1_100
        }
      ]
    };

    const html = generateSalesOrderPrintHtml(order);

    expect(html).toContain("Sales Order");
    expect(html).toContain("Dock 3<br>Bay &lt;A&gt;");
    expect(html).toContain("Bundle &lt;retail&gt;");
    expect(html).toContain("$1.00");
    expect(html).toContain("$2.00");
    expect(html).toContain("$11.00");
  });

  it("escapes CSV cells, emits Excel-compatible BOM content, and sanitizes filenames", () => {
    const csv = generateCsv(
      ["Name", "Notes"],
      [
        ["Acme, Inc.", 'quoted "line"\nnext'],
        [null, "plain"]
      ]
    );

    expect(csv).toBe('Name,Notes\r\n"Acme, Inc.","quoted ""line""\nnext"\r\n,plain');
    expect(csvWithBom(csv).startsWith("\ufeff")).toBe(true);
    expect(
      safeDocumentFilename({
        prefix: "invoice",
        number: "INV/42:*?",
        customerName: "A <B>",
        date: "2026-06-21T12:00:00.000Z",
        extension: ".csv"
      })
    ).toBe("invoice - INV_42___ - A _B_ - 2026-06-21.csv");
  });

  it("exports invoice line items as CSV using dollar amounts and tax rates", () => {
    const csv = generateInvoiceLineItemsCsv(invoice);

    expect(csv.split("\r\n")[0]).toBe("Invoice,Description,Quantity,Unit price,Tax rate,Amount,Currency");
    expect(csv).toContain('"Discovery, setup, and ""launch"""');
    expect(csv).toContain(",50.00,8.75%,100.00,USD");
  });
});
