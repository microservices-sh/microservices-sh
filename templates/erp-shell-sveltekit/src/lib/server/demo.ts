/**
 * Local demo seeding — composition glue, NOT module internals.
 *
 * Seeds the in-memory module stores once per dev session by calling the modules'
 * own use cases (upsertCustomer, createInvoice/issueInvoice, createUploadTicket/
 * completeUpload, recordEvent). No domain logic lives here: it only drives the
 * public module surface so the ERP shell renders real data locally without
 * D1/R2. When DB/R2 bindings exist the seeding is skipped (see hooks.server.ts).
 */
import { upsertCustomer } from "@microservices-sh/customer";
import type { CustomerRepository } from "@microservices-sh/customer/ports";
import { createTicket } from "@microservices-sh/support-ticket";
import type { TicketStore } from "@microservices-sh/support-ticket/ports";
import { createInvoice, issueInvoice } from "@microservices-sh/invoice";
import type { InvoiceStore, NumberAllocator } from "@microservices-sh/invoice/ports";
import { createUploadTicket, completeUpload } from "@microservices-sh/file-media";
import type { MediaStore, ObjectStorage } from "@microservices-sh/file-media/ports";
import { recordEvent } from "@microservices-sh/audit-log";
import type { AuditEventStore } from "@microservices-sh/audit-log/ports";

export interface DemoDeps {
  tenantId: string;
  customerRepository: CustomerRepository;
  ticketStore: TicketStore;
  invoiceStore: InvoiceStore;
  numberAllocator: NumberAllocator;
  mediaStore: MediaStore;
  objectStorage: ObjectStorage & { setSize?: (key: string, info: { size: number; contentType?: string }) => void };
  auditStore: AuditEventStore;
}

let seeded = false;

const DEMO_CUSTOMERS = [
  { name: "Acme Studios", email: "owner@acme.example", phone: "+1 555 0100", notes: "Retainer client." },
  { name: "Borealis Legal", email: "billing@borealis.example", phone: "+1 555 0123", notes: null }
];

const DEMO_TICKETS = [
  {
    subject: "Invoice PDF won't download",
    description: "The download button on the latest invoice returns a 404.",
    requesterEmail: "owner@acme.example",
    priority: "high"
  },
  {
    subject: "Add a second billing contact",
    description: "Please CC our finance team on monthly statements.",
    requesterEmail: "billing@borealis.example",
    priority: "normal"
  }
];

export async function seedDemoData(deps: DemoDeps): Promise<void> {
  if (seeded) return;
  seeded = true;

  for (const profile of DEMO_CUSTOMERS) {
    const customerResult = await upsertCustomer(profile, { customerRepository: deps.customerRepository });
    if (!customerResult.ok || !customerResult.data) continue;
    const customer = customerResult.data.customer;

    await recordEvent(
      {
        eventName: "customer.created",
        entityType: "customer",
        entityId: customer.id,
        actorId: "system:seed",
        source: "erp-shell-seed",
        payload: { email: customer.email }
      },
      { auditStore: deps.auditStore }
    );

    // Two invoices per customer: one issued (numbered) and one draft.
    const invoiceA = await createInvoice(
      {
        tenantId: deps.tenantId,
        customerId: customer.id,
        currency: "USD",
        series: "INV",
        notes: "Monthly retainer.",
        lineItems: [
          { description: "Consulting (hours)", quantity: 10, unitAmountCents: 15000, taxRateBps: 0 },
          { description: "Project setup", quantity: 1, unitAmountCents: 50000, taxRateBps: 875 }
        ]
      },
      { invoiceStore: deps.invoiceStore }
    );
    if (invoiceA.ok) {
      await issueInvoice(
        { invoiceId: invoiceA.data.id, termsDays: 14 },
        { invoiceStore: deps.invoiceStore, allocator: deps.numberAllocator }
      );
      await recordEvent(
        {
          eventName: "invoice.issued",
          entityType: "invoice",
          entityId: invoiceA.data.id,
          actorId: "system:seed",
          source: "erp-shell-seed",
          payload: { totalCents: invoiceA.data.totalCents }
        },
        { auditStore: deps.auditStore }
      );
    }

    await createInvoice(
      {
        tenantId: deps.tenantId,
        customerId: customer.id,
        currency: "USD",
        series: "INV",
        notes: "Draft — pending approval.",
        lineItems: [{ description: "Additional scope", quantity: 4, unitAmountCents: 12000, taxRateBps: 0 }]
      },
      { invoiceStore: deps.invoiceStore }
    );

    // One completed demo file per customer using the two-step upload flow.
    const ticket = await createUploadTicket(
      {
        tenantId: deps.tenantId,
        originalName: "statement.pdf",
        contentType: "application/pdf",
        declaredBytes: 2048
      },
      { mediaStore: deps.mediaStore }
    );
    if (ticket.ok && ticket.data.ticketId) {
      const body = "%PDF-1.4 demo statement";
      await deps.objectStorage.put(ticket.data.key, body, { contentType: "application/pdf" });
      deps.objectStorage.setSize?.(ticket.data.key, { size: body.length, contentType: "application/pdf" });
      await completeUpload(
        { ticketId: ticket.data.ticketId, tenantId: deps.tenantId },
        { mediaStore: deps.mediaStore, storage: deps.objectStorage }
      );
    }
  }

  // A couple of demo support tickets scoped to the company tenant.
  for (const ticket of DEMO_TICKETS) {
    const ticketResult = await createTicket(
      { tenantId: deps.tenantId, ...ticket },
      { store: deps.ticketStore }
    );
    if (!ticketResult.ok || !ticketResult.data) continue;

    await recordEvent(
      {
        eventName: "support-ticket.created",
        entityType: "support-ticket",
        entityId: ticketResult.data.ticket.id,
        actorId: "system:seed",
        source: "erp-shell-seed",
        payload: { requesterEmail: ticket.requesterEmail, priority: ticketResult.data.ticket.priority }
      },
      { auditStore: deps.auditStore }
    );
  }
}
