export { moduleDefinition, manifest } from "./manifest";
export { defaultConfig, configSchema } from "./config";
export { events } from "./events";
export { permissions } from "./permissions";
export { resources } from "./resources";
export { createInvoice } from "./use-cases/create-invoice";
export { addLineItem } from "./use-cases/add-line-item";
export { issueInvoice } from "./use-cases/issue-invoice";
export { recordPayment } from "./use-cases/record-payment";
export { voidInvoice } from "./use-cases/void-invoice";
export { listInvoices } from "./use-cases/list-invoices";
export { dueForReminder } from "./use-cases/due-for-reminder";
export {
  listInvoicesScoped,
  getInvoiceScoped,
  issueInvoiceScoped,
  recordPaymentScoped,
  voidInvoiceScoped,
  addLineItemScoped
} from "./use-cases/scoped";
// Re-export the auth primitive so consumers of the *Scoped use-cases have a
// validated way to build the AuthContext they require (plan 33).
export { authContext } from "@microservices-sh/connection-contract";
export type { AuthContext } from "@microservices-sh/connection-contract";
export { computeTotals, lineAmountCents, lineTaxCents } from "./totals";
export { createD1InvoiceStore } from "./adapters/d1-invoice-store";
export { createD1NumberAllocator } from "./adapters/d1-number-allocator";
export { createMemoryInvoiceStore } from "./adapters/memory-invoice-store";
export { createMemoryNumberAllocator } from "./adapters/memory-number-allocator";
export type { InvoiceStore, NumberAllocator } from "./ports";
export type {
  Invoice,
  InvoiceWithLines,
  InvoiceLineItem,
  InvoiceStatus,
  InvoiceFilter,
  InvoiceTotals
} from "./types";
