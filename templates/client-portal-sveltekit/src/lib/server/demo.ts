/**
 * Local demo seeding — composition glue, NOT module internals.
 *
 * Seeds the in-memory module stores once per dev session by calling the
 * modules' own use cases (createInvoice/issueInvoice, createUploadTicket/
 * completeUpload, upsertCustomer, recordEvent). No domain logic lives here:
 * it only drives the public module surface so the portal renders real data
 * locally without D1/R2. When DB/R2 bindings exist the seeding is skipped and
 * the persisted stores are used instead.
 */
import { upsertCustomer } from "@microservices-sh/customer";
import type { CustomerRepository } from "@microservices-sh/customer/ports";
import { createInvoice, issueInvoice } from "@microservices-sh/invoice";
import type { InvoiceStore, NumberAllocator } from "@microservices-sh/invoice/ports";
import { createUploadTicket, completeUpload } from "@microservices-sh/file-media";
import type { MediaStore, ObjectStorage } from "@microservices-sh/file-media/ports";
import { recordEvent } from "@microservices-sh/audit-log";
import type { AuditEventStore } from "@microservices-sh/audit-log/ports";

export interface DemoDeps {
  tenantId: string;
  customerRepository: CustomerRepository;
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
        source: "client-portal-seed",
        payload: { email: customer.email }
      },
      { auditStore: deps.auditStore }
    );

    // Two invoices per customer: one paid (issued + numbered) and one draft.
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
          source: "client-portal-seed",
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
        ownerId: customer.id,
        originalName: "statement.pdf",
        contentType: "application/pdf",
        declaredBytes: 2048
      },
      { mediaStore: deps.mediaStore }
    );
    if (ticket.ok && ticket.data.ticketId) {
      // Land bytes at the reserved key, then complete. The memory object storage
      // exposes setSize so head() reports a size; real R2 reflects the PUT.
      const body = "%PDF-1.4 demo statement";
      await deps.objectStorage.put(ticket.data.key, body, { contentType: "application/pdf" });
      deps.objectStorage.setSize?.(ticket.data.key, { size: body.length, contentType: "application/pdf" });
      await completeUpload(
        { ticketId: ticket.data.ticketId, tenantId: deps.tenantId },
        { mediaStore: deps.mediaStore, storage: deps.objectStorage }
      );
    }
  }
}
