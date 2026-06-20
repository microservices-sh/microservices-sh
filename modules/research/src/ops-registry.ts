// Operate-app ops registry (Plan 32, P1). The composition helper the client's
// operate app uses to expose its module read use-cases as governed ops tools.
//
// Two responsibilities, both kept module-agnostic (dependency-injected — no
// cross-module imports, so this stays in-bounds for the research module):
//   1. `createOpsRegistry` — attach the canonical per-tool scope to each handler
//      the app provides, and reject unknown tool names (typo protection).
//   2. `to*Record` mappers — the canonical "operational record → cited evidence"
//      logic: turn a module entity into an OpsRecord whose citation is the live
//      record ref (module:entityId) with an as-of stamp. The app wires its real
//      read use-case + store and calls the matching mapper.

import type { OpsRecord } from "./ops";
import type { OpsServerRegistry, OpsServerTool, OpsToolHandler } from "./ops-server";

// Canonical tool → required scope. The one place the ops scope contract lives.
export const OPS_TOOL_SCOPES = {
  "ops.customer.read": "ops.customer.read",
  "ops.invoice.read": "ops.invoice.read",
  "ops.booking.read": "ops.booking.read",
  "ops.ticket.read": "ops.support_ticket.read",
  "ops.calendar.read": "ops.calendar.read"
} as const;

export type OpsToolName = keyof typeof OPS_TOOL_SCOPES;

export function createOpsRegistry(handlers: Partial<Record<OpsToolName, OpsToolHandler>>): OpsServerRegistry {
  const registry: OpsServerRegistry = {};
  for (const [tool, handler] of Object.entries(handlers)) {
    const scope = OPS_TOOL_SCOPES[tool as OpsToolName];
    if (!scope || !handler) throw new Error(`Unknown ops tool: ${tool}`);
    registry[tool] = { scope, handler } satisfies OpsServerTool;
  }
  return registry;
}

const join = (parts: Array<string | undefined | null>) => parts.filter(Boolean).join(" · ");

// ---- record mappers (structural inputs — match the modules' entity shapes) ----

export function toCustomerRecord(c: { id: string; name: string; phone?: string | null; email?: string | null; notes?: string | null }, asOf: number): OpsRecord {
  return {
    module: "customer",
    entityId: c.id,
    asOf,
    label: `Customer ${c.name}`,
    text: join([c.name, c.phone ?? undefined, c.email ?? undefined, c.notes ?? undefined]),
    fields: { name: c.name, phone: c.phone ?? null, email: c.email ?? null }
  };
}

export function toInvoiceRecord(
  inv: { invoiceId: string; customerId?: string; currency?: string; status?: string; totalCents?: number },
  asOf: number
): OpsRecord {
  const amount = typeof inv.totalCents === "number" ? `${(inv.totalCents / 100).toFixed(2)} ${inv.currency ?? ""}`.trim() : undefined;
  return {
    module: "invoice",
    entityId: inv.invoiceId,
    asOf,
    label: `Invoice ${inv.invoiceId}${inv.status ? ` (${inv.status})` : ""}`,
    text: join([`Invoice ${inv.invoiceId}`, inv.customerId ? `customer ${inv.customerId}` : undefined, amount, inv.status]),
    fields: { customerId: inv.customerId ?? null, currency: inv.currency ?? null, status: inv.status ?? null, totalCents: inv.totalCents ?? null }
  };
}

export function toBookingRecord(
  b: { id: string; serviceId?: string; date?: string; customerName?: string; status?: string },
  asOf: number
): OpsRecord {
  return {
    module: "booking",
    entityId: b.id,
    asOf,
    label: `Booking ${b.id}${b.date ? ` on ${b.date}` : ""}`,
    text: join([`Booking ${b.id}`, b.date, b.serviceId ? `service ${b.serviceId}` : undefined, b.customerName, b.status]),
    fields: { serviceId: b.serviceId ?? null, date: b.date ?? null, customerName: b.customerName ?? null, status: b.status ?? null }
  };
}

export function toTicketRecord(
  t: { id: string; subject?: string; status?: string; requesterEmail?: string; assigneeId?: string },
  asOf: number
): OpsRecord {
  return {
    module: "support-ticket",
    entityId: t.id,
    asOf,
    label: `Ticket: ${t.subject ?? t.id}`,
    text: join([t.subject, t.status, t.requesterEmail ? `from ${t.requesterEmail}` : undefined, t.assigneeId ? `assignee ${t.assigneeId}` : undefined]),
    fields: { subject: t.subject ?? null, status: t.status ?? null, requesterEmail: t.requesterEmail ?? null, assigneeId: t.assigneeId ?? null }
  };
}

export function toCalendarRecord(
  e: { id: string; summary?: string; start?: string; end?: string; calendarId?: string },
  asOf: number
): OpsRecord {
  return {
    module: "calendar-google",
    entityId: e.id,
    asOf,
    label: `Event: ${e.summary ?? e.id}`,
    text: join([e.summary, e.start ? `starts ${e.start}` : undefined, e.end ? `ends ${e.end}` : undefined, e.calendarId]),
    fields: { summary: e.summary ?? null, start: e.start ?? null, end: e.end ?? null, calendarId: e.calendarId ?? null }
  };
}
