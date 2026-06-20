/**
 * Local demo seeding — composition glue, NOT module internals.
 *
 * Seeds the in-memory module stores once per dev session by calling the modules'
 * own use cases (upsertCustomer, createInvoice/issueInvoice/recordPayment,
 * createUploadTicket/completeUpload, createTicket, recordEvent). No domain logic
 * lives here: it only drives the public module surface so the ERP shell renders a
 * believable, *connected* operational story locally without D1/R2.
 *
 * The connective tissue is the customer id + email: invoices carry `customerId`,
 * files carry `ownerId = customerId`, tickets carry `requesterEmail`, and every
 * write emits an audit event scoped to the customer entity — so the Customer 360
 * page and the dashboard can reconstruct a cross-module timeline. When DB/R2
 * bindings exist the seeding is skipped (see hooks.server.ts).
 */
import { upsertCustomer } from "@microservices-sh/customer";
import type { CustomerRepository } from "@microservices-sh/customer/ports";
import { createTicket } from "@microservices-sh/support-ticket";
import type { TicketStore } from "@microservices-sh/support-ticket/ports";
import { createInvoice, issueInvoice, recordPayment } from "@microservices-sh/invoice";
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
	objectStorage: ObjectStorage & {
		setSize?: (key: string, info: { size: number; contentType?: string }) => void;
	};
	auditStore: AuditEventStore;
}

let seeded = false;

interface InvoiceSpec {
	notes: string;
	lineItems: Array<{
		description: string;
		quantity?: number;
		unitAmountCents: number;
		taxRateBps?: number;
	}>;
	/** issue (allocate a number + due date) vs leave as draft. */
	issue: boolean;
	/** terms; negative makes the demo invoice overdue. */
	termsDays?: number;
	/** record a full payment after issuing (→ paid). */
	payInFull?: boolean;
}

interface CustomerSpec {
	name: string;
	email: string;
	phone: string | null;
	notes: string | null;
	invoices: InvoiceSpec[];
	files: Array<{ name: string; contentType: string }>;
}

// Two customers with intentionally different operational shapes so the dashboard
// shows real signal: Acme has a paid invoice, an overdue one, and a draft;
// Borealis has one healthy open invoice and a draft.
const DEMO_CUSTOMERS: CustomerSpec[] = [
	{
		name: "Acme Studios",
		email: "owner@acme.example",
		phone: "+1 555 0100",
		notes: "Retainer client.",
		invoices: [
			{
				notes: "Monthly retainer — March.",
				issue: true,
				termsDays: 14,
				payInFull: true,
				lineItems: [
					{ description: "Consulting (hours)", quantity: 10, unitAmountCents: 15000, taxRateBps: 0 },
					{ description: "Project setup", quantity: 1, unitAmountCents: 50000, taxRateBps: 875 }
				]
			},
			{
				notes: "Monthly retainer — April. Past due.",
				issue: true,
				termsDays: -6,
				lineItems: [
					{ description: "Consulting (hours)", quantity: 12, unitAmountCents: 15000, taxRateBps: 0 }
				]
			},
			{
				notes: "Draft — pending approval.",
				issue: false,
				lineItems: [{ description: "Additional scope", quantity: 4, unitAmountCents: 12000, taxRateBps: 0 }]
			}
		],
		files: [{ name: "statement-march.pdf", contentType: "application/pdf" }]
	},
	{
		name: "Borealis Legal",
		email: "billing@borealis.example",
		phone: "+1 555 0123",
		notes: null,
		invoices: [
			{
				notes: "Quarterly engagement.",
				issue: true,
				termsDays: 21,
				lineItems: [
					{ description: "Advisory (hours)", quantity: 8, unitAmountCents: 22000, taxRateBps: 0 }
				]
			},
			{
				notes: "Draft — awaiting scope sign-off.",
				issue: false,
				lineItems: [{ description: "Document review", quantity: 6, unitAmountCents: 18000, taxRateBps: 0 }]
			}
		],
		files: [{ name: "engagement-letter.pdf", contentType: "application/pdf" }]
	}
];

const DEMO_TICKETS = [
	{
		subject: "Invoice PDF won't download",
		description: "The download button on the latest invoice returns a 404.",
		requesterEmail: "owner@acme.example",
		priority: "high" as const
	},
	{
		subject: "Add a second billing contact",
		description: "Please CC our finance team on monthly statements.",
		requesterEmail: "billing@borealis.example",
		priority: "normal" as const
	}
];

export async function seedDemoData(deps: DemoDeps): Promise<void> {
	if (seeded) return;
	seeded = true;

	const audit = (input: {
		eventName: string;
		entityType: string;
		entityId: string;
		payload?: Record<string, unknown>;
	}) =>
		recordEvent(
			{ ...input, actorId: "system:seed", source: "erp-shell-seed" },
			{ auditStore: deps.auditStore }
		);

	for (const profile of DEMO_CUSTOMERS) {
		const customerResult = await upsertCustomer(
			{ name: profile.name, email: profile.email, phone: profile.phone, notes: profile.notes },
			{ customerRepository: deps.customerRepository }
		);
		if (!customerResult.ok || !customerResult.data) continue;
		const customer = customerResult.data.customer;

		await audit({
			eventName: "customer.created",
			entityType: "customer",
			entityId: customer.id,
			payload: { email: customer.email }
		});

		// Invoices — drive create → (issue) → (pay), emitting customer-scoped audit
		// events at each step so the Customer 360 timeline reads as one workflow.
		for (const spec of profile.invoices) {
			const created = await createInvoice(
				{
					tenantId: deps.tenantId,
					customerId: customer.id,
					currency: "USD",
					series: "INV",
					notes: spec.notes,
					lineItems: spec.lineItems
				},
				{ invoiceStore: deps.invoiceStore }
			);
			if (!created.ok || !created.data) continue;
			const invoiceId = created.data.id;
			const totalCents = created.data.totalCents;

			if (!spec.issue) continue;

			const issued = await issueInvoice(
				{ invoiceId, termsDays: spec.termsDays ?? 14 },
				{ invoiceStore: deps.invoiceStore, allocator: deps.numberAllocator }
			);
			if (!issued.ok || !issued.data) continue;

			await audit({
				eventName: "invoice.issued",
				entityType: "customer",
				entityId: customer.id,
				payload: { invoiceId, number: issued.data.number, totalCents }
			});

			if (spec.payInFull) {
				const paid = await recordPayment(
					{ invoiceId, amountCents: totalCents },
					{ invoiceStore: deps.invoiceStore }
				);
				if (paid.ok && paid.data) {
					await audit({
						eventName: "invoice.payment_recorded",
						entityType: "customer",
						entityId: customer.id,
						payload: { invoiceId, amountCents: totalCents, status: paid.data.status }
					});
				}
			}
		}

		// One completed demo file per customer, OWNED BY the customer (ownerId) so
		// it surfaces on the Customer 360 files tab via listFiles({ ownerId }).
		for (const file of profile.files) {
			const ticket = await createUploadTicket(
				{
					tenantId: deps.tenantId,
					ownerId: customer.id,
					originalName: file.name,
					contentType: file.contentType,
					declaredBytes: 2048
				},
				{ mediaStore: deps.mediaStore }
			);
			if (ticket.ok && ticket.data && ticket.data.ticketId) {
				const body = "%PDF-1.4 demo document";
				await deps.objectStorage.put(ticket.data.key, body, { contentType: file.contentType });
				deps.objectStorage.setSize?.(ticket.data.key, {
					size: body.length,
					contentType: file.contentType
				});
				await completeUpload(
					{ ticketId: ticket.data.ticketId, tenantId: deps.tenantId },
					{ mediaStore: deps.mediaStore, storage: deps.objectStorage }
				);
				await audit({
					eventName: "file.uploaded",
					entityType: "customer",
					entityId: customer.id,
					payload: { originalName: file.name }
				});
			}
		}
	}

	// Support tickets, linked to customers by requester email.
	for (const ticket of DEMO_TICKETS) {
		const ticketResult = await createTicket(
			{ tenantId: deps.tenantId, ...ticket },
			{ store: deps.ticketStore }
		);
		if (!ticketResult.ok || !ticketResult.data) continue;

		await audit({
			eventName: "support-ticket.created",
			entityType: "support-ticket",
			entityId: ticketResult.data.ticket.id,
			payload: {
				requesterEmail: ticket.requesterEmail,
				priority: ticketResult.data.ticket.priority
			}
		});
	}
}
