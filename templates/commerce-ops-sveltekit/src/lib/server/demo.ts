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
import { createProduct } from "@microservices-sh/product-catalog";
import type { ProductCatalogStore } from "@microservices-sh/product-catalog/ports";
import { stockIn } from "@microservices-sh/inventory";
import type { InventoryStore } from "@microservices-sh/inventory/ports";
import { confirmOrder, createDraftOrder } from "@microservices-sh/sales-order";
import type { SalesOrderStore } from "@microservices-sh/sales-order/ports";
import type { CommerceSyncService } from "@microservices-sh/commerce-sync";
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
	productCatalogStore: ProductCatalogStore;
	inventoryStore: InventoryStore;
	salesOrderStore: SalesOrderStore;
	commerceSyncService: CommerceSyncService;
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

const DEMO_PRODUCTS = [
	{
		sku: "KIT-STARTER",
		name: "Starter operations kit",
		description: "Packaged onboarding kit for new commerce clients.",
		priceCents: 12900,
		unit: "kit",
		reorderPoint: 10,
		reorderQuantity: 25,
		openingStock: 42
	},
	{
		sku: "BOX-REFILL",
		name: "Refill box",
		description: "Consumable refill inventory used in monthly shipments.",
		priceCents: 3900,
		unit: "box",
		reorderPoint: 20,
		reorderQuantity: 50,
		openingStock: 18
	},
	{
		sku: "SVC-INSTALL",
		name: "Installation service",
		description: "Non-stock service line for field setup work.",
		priceCents: 24000,
		unit: "service",
		reorderPoint: 0,
		reorderQuantity: 0,
		openingStock: 0,
		trackStock: false
	}
];

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
			{ ...input, actorId: "system:seed", source: "commerce-ops-seed" },
			{ auditStore: deps.auditStore }
		);

	const seededProducts: Array<{ id: string; sku: string; name: string; priceCents: number; trackStock: boolean }> = [];
	const seededCustomers: Array<{ id: string; name: string; email: string }> = [];

	for (const spec of DEMO_PRODUCTS) {
		const created = await createProduct(
			{
				tenantId: deps.tenantId,
				sku: spec.sku,
				name: spec.name,
				description: spec.description,
				priceCents: spec.priceCents,
				currency: "USD",
				unit: spec.unit,
				productType: "simple",
				trackStock: spec.trackStock ?? true,
				reorderPoint: spec.reorderPoint,
				reorderQuantity: spec.reorderQuantity
			},
			{
				productCatalogStore: deps.productCatalogStore,
				actor: { id: "system:seed" }
			}
		);
		if (!created.ok || !created.data) continue;
		seededProducts.push({
			id: created.data.product.id,
			sku: created.data.product.sku,
			name: created.data.product.name,
			priceCents: created.data.product.priceCents,
			trackStock: created.data.product.trackStock
		});

		await audit({
			eventName: "product-catalog.product_created",
			entityType: "product",
			entityId: created.data.product.id,
			payload: { sku: created.data.product.sku, name: created.data.product.name }
		});

		if (created.data.product.trackStock && spec.openingStock > 0) {
			const received = await stockIn(
				{
					tenantId: deps.tenantId,
					productId: created.data.product.id,
					locationId: "default",
					quantity: spec.openingStock,
					sourceType: "demo-seed",
					sourceId: `opening:${spec.sku}`,
					reason: "Opening demo stock."
				},
				{
					inventoryStore: deps.inventoryStore,
					actor: { id: "system:seed" }
				}
			);

			if (received.ok && received.data) {
				await audit({
					eventName: "inventory.stock_received",
					entityType: "stock_movement",
					entityId: received.data.movement.id,
					payload: { sku: spec.sku, quantity: spec.openingStock }
				});
			}
		}
	}

	if (seededProducts.length > 0) {
		const ctx = { tenantId: deps.tenantId, now: "2026-06-21T00:00:00.000Z" };
		const connections = await deps.commerceSyncService.listCommerceConnections(ctx);
		const existingConnection = connections.ok
			? connections.data.find((connection) => connection.provider === "shopify" && connection.name === "Shopify primary")
			: undefined;
		const connection = existingConnection
			? { ok: true as const, data: existingConnection }
			: await deps.commerceSyncService.createCommerceConnection(ctx, {
					provider: "shopify",
					name: "Shopify primary",
					baseUrl: "https://store.example.com",
					secretRef: "secret://commerce/shopify-primary"
				});

		if (connection.ok) {
			const run = await deps.commerceSyncService.startSyncRun(ctx, connection.data.id, "product");
			if (run.ok) {
				await deps.commerceSyncService.completeSyncRun(ctx, run.data.id, {
					processedCount: 128,
					createdCount: 9,
					updatedCount: 41,
					failedCount: 0
				});
			}
			await deps.commerceSyncService.recordProviderMapping(ctx, {
				connectionId: connection.data.id,
				resourceType: "product",
				externalId: "gid://shopify/Product/1001",
				internalId: seededProducts[0].id
			});
			await deps.commerceSyncService.recordWebhookReceipt(ctx, {
				connectionId: connection.data.id,
				topic: "orders/create",
				idempotencyKey: "demo-orders-create-001",
				signature: "sha256=demo",
				payload: { orderId: "shopify-1001" }
			});
		}
	}

	for (const profile of DEMO_CUSTOMERS) {
		const customerResult = await upsertCustomer(
			{ name: profile.name, email: profile.email, phone: profile.phone, notes: profile.notes },
			{ customerRepository: deps.customerRepository }
		);
		if (!customerResult.ok || !customerResult.data) continue;
		const customer = customerResult.data.customer;
		seededCustomers.push({ id: customer.id, name: customer.name, email: customer.email ?? profile.email });

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

	if (seededProducts.length > 0 && seededCustomers.length > 0) {
		const customer = seededCustomers[0];
		const stockProduct = seededProducts.find((product) => product.trackStock) ?? seededProducts[0];
		const order = await createDraftOrder(
			{
				tenantId: deps.tenantId,
				orderNumber: "SO-DEMO-1001",
				customerId: customer.id,
				customerSnapshot: {
					displayName: customer.name,
					email: customer.email
				},
				currency: "USD",
				notes: "Demo order ready for fulfillment.",
				lineItems: [
					{
						productId: stockProduct.id,
						sku: stockProduct.sku,
						name: stockProduct.name,
						quantity: 2,
						unitPriceCents: stockProduct.priceCents
					}
				]
			},
			{
				salesOrderStore: deps.salesOrderStore,
				actor: { id: "system:seed" }
			}
		);

		if (order.ok && order.data) {
			await audit({
				eventName: "sales-order.order_created",
				entityType: "sales-order",
				entityId: order.data.order.id,
				payload: { orderNumber: order.data.order.orderNumber, totalCents: order.data.order.totalCents }
			});

			const confirmed = await confirmOrder(
				{ tenantId: deps.tenantId, orderId: order.data.order.id },
				{
					salesOrderStore: deps.salesOrderStore,
					actor: { id: "system:seed" }
				}
			);
			if (confirmed.ok && confirmed.data) {
				await audit({
					eventName: "sales-order.order_confirmed",
					entityType: "sales-order",
					entityId: confirmed.data.order.id,
					payload: { orderNumber: confirmed.data.order.orderNumber, totalCents: confirmed.data.order.totalCents }
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
