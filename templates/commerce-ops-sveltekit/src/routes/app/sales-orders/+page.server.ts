import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { recordEvent } from "@microservices-sh/audit-log";
import { getCustomer, listCustomers, upsertCustomer } from "@microservices-sh/customer";
import { sendEmail } from "@microservices-sh/email";
import { authContext, createInvoice, issueInvoiceScoped } from "@microservices-sh/invoice";
import { listProducts } from "@microservices-sh/product-catalog";
import {
  cancelOrder,
  confirmOrder,
  createDraftOrder,
  listOrders,
  markOrderInvoiced,
  sendSalesOrder,
  type InvoiceDraftPort,
  type SalesOrderDeliveryPort
} from "@microservices-sh/sales-order";
import { loadCompanyContext, requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";
import { buildSalesOrderEmail } from "$lib/server/sales-order-email";
import {
  createSalesOrderInventoryReservationPort,
  releaseSalesOrderReservations
} from "$lib/server/sales-order-inventory";

function text(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function cents(value: string): number | null {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null;
}

function positiveInteger(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function orderLineToInvoiceLine(line: {
  name: string;
  description: string | null;
  quantity: number;
  unitPriceCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
}) {
  const description = (line.description || line.name).trim();
  if (line.discountCents === 0 && line.taxCents === 0) {
    return {
      description,
      quantity: line.quantity,
      unitAmountCents: line.unitPriceCents,
      taxRateBps: 0
    };
  }

  return {
    description: `${description} (sales order qty ${line.quantity}, adjusted total)`.slice(0, 500),
    quantity: 1,
    unitAmountCents: line.totalCents,
    taxRateBps: 0
  };
}

function invoiceDraftPort(locals: App.Locals, actorId: string, permissions: string[]): InvoiceDraftPort {
  return {
    async createDraftFromSalesOrder({ order }) {
      let customerId = order.customerId;
      if (!customerId) {
        const snapshot = order.customerSnapshot;
        if (!snapshot?.displayName || !snapshot.email) {
          throw new Error("Create or select a customer with an email before invoicing this sales order.");
        }
        const customer = await upsertCustomer(
          {
            name: snapshot.displayName,
            email: snapshot.email,
            phone: snapshot.phone,
            notes: "Created from sales order invoice handoff."
          },
          { customerRepository: locals.customerRepository, actor: { id: actorId } }
        );
        if (!customer.ok || !customer.data) throw new Error(customer.ok ? "Could not create customer." : customer.error.message);
        customerId = customer.data.customer.id;
      }

      const created = await createInvoice(
        {
          tenantId: order.tenantId,
          customerId,
          currency: order.currency,
          series: "INV",
          notes: `Sales order ${order.orderNumber ?? order.id}${order.notes ? ` - ${order.notes}` : ""}`,
          lineItems: order.lineItems.map(orderLineToInvoiceLine)
        },
        { invoiceStore: locals.invoiceStore }
      );
      if (!created.ok || !created.data) throw new Error(created.ok ? "Could not create invoice." : created.error.message);

      const issued = await issueInvoiceScoped(
        authContext({ orgId: order.tenantId, actorId, roles: permissions }),
        { invoiceId: created.data.id, termsDays: 14 },
        { invoiceStore: locals.invoiceStore, allocator: locals.numberAllocator }
      );
      if (!issued.ok || !issued.data) throw new Error(issued.ok ? "Could not issue invoice." : issued.error.message);

      await recordEvent(
        {
          eventName: "invoice.issued",
          actorId,
          entityType: "invoice",
          entityId: created.data.id,
          source: "app/sales-orders",
          payload: { number: issued.data.number, customerId, salesOrderId: order.id }
        },
        { auditStore: locals.auditStore }
      );

      return { invoiceId: created.data.id, invoiceNumber: issued.data.number };
    }
  };
}

function salesOrderDeliveryPort(locals: App.Locals, orgName: string, actorId: string, actorEmail?: string): SalesOrderDeliveryPort {
  return {
    async sendSalesOrder({ order, toEmail, subject, message, idempotencyKey }) {
      const email = buildSalesOrderEmail({ order, companyName: orgName, message });
      const sent = await sendEmail(
        {
          from: locals.emailFrom,
          to: [toEmail],
          subject: subject || email.subject,
          html: email.html,
          text: email.text,
          idempotencyKey: idempotencyKey ?? `sales-order-send:${order.id}:${Date.now()}`,
          tags: [
            { name: "module", value: "sales-order" },
            { name: "template", value: "commerce-ops-sveltekit" }
          ],
          metadata: {
            salesOrderId: order.id,
            orderNumber: order.orderNumber,
            status: order.status
          }
        },
        {
          provider: locals.emailProvider,
          emailRepository: locals.emailRepository,
          actor: { id: actorId, email: actorEmail }
        }
      );
      if (!sent.ok || !sent.data) {
        return {
          provider: "email",
          status: "failed",
          errorCode: sent.ok ? "email.UNKNOWN_SEND_FAILURE" : sent.error.code,
          errorMessage: sent.ok ? "Could not send the sales order email." : sent.error.message
        };
      }
      return {
        provider: sent.data.delivery.provider,
        deliveryId: sent.data.delivery.id,
        status: sent.data.delivery.status
      };
    }
  };
}

export const load: PageServerLoad = async ({ locals, cookies, parent, platform }) => {
  requireModule("sales-order", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);
  const [ordersResult, productsResult, customersResult] = await Promise.all([
    listOrders({ tenantId: activeOrgId, limit: 100 }, { salesOrderStore: locals.salesOrderStore }),
    listProducts({ tenantId: activeOrgId, includeInactive: false, limit: 250 }, { productCatalogStore: locals.productCatalogStore }),
    listCustomers({ customerRepository: locals.customerRepository })
  ]);

  return {
    canManage: permissions.includes("*") || permissions.includes("member.manage"),
    orders: ordersResult.ok ? ordersResult.data.orders : [],
    customers: customersResult.ok
      ? customersResult.data.customers.map((customer) => ({
          id: customer.id,
          name: customer.name,
          email: customer.email
        }))
      : [],
    products: productsResult.ok
      ? productsResult.data.products.map((product) => ({
          id: product.id,
          sku: product.sku,
          name: product.name,
          priceCents: product.priceCents,
          currency: product.currency
        }))
      : []
  };
};

export const actions: Actions = {
  create: async ({ request, locals, cookies, platform }) => {
    requireModule("sales-order", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    const { permissions } = await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const values = {
      customerId: text(form.get("customerId")),
      customerName: text(form.get("customerName")),
      customerEmail: text(form.get("customerEmail")),
      productId: text(form.get("productId")),
      sku: text(form.get("sku")),
      itemName: text(form.get("itemName")),
      quantity: text(form.get("quantity")),
      unitPrice: text(form.get("unitPrice")),
      currency: text(form.get("currency")).toUpperCase() || "USD",
      notes: text(form.get("notes"))
    };
    const quantity = positiveInteger(values.quantity);
    const unitPriceCents = cents(values.unitPrice);
    if (!values.itemName || !quantity || unitPriceCents == null) {
      return fail(400, { error: "Enter an item name, positive quantity, and non-negative price.", values });
    }

    let customerId: string;
    let customerSnapshot: { displayName: string; email: string } | null = null;
    if (values.customerId) {
      const customer = await getCustomer({ id: values.customerId }, { customerRepository: locals.customerRepository });
      if (!customer.ok || !customer.data) return fail(customer.status, { error: customer.error.message, values });
      customerId = customer.data.customer.id;
      customerSnapshot = {
        displayName: customer.data.customer.name,
        email: customer.data.customer.email
      };
    } else {
      if (!values.customerName || !values.customerEmail) {
        return fail(400, { error: "Select an existing customer or enter a customer name and email.", values });
      }
      const customer = await upsertCustomer(
        {
          name: values.customerName,
          email: values.customerEmail
        },
        { customerRepository: locals.customerRepository, actor: { id: locals.user.id, email: locals.user.email } }
      );
      if (!customer.ok || !customer.data) return fail(customer.status, { error: customer.error.message, values });
      customerId = customer.data.customer.id;
      customerSnapshot = {
        displayName: customer.data.customer.name,
        email: customer.data.customer.email
      };
    }

    const result = await createDraftOrder(
      {
        tenantId: org.id,
        customerId,
        customerSnapshot,
        currency: values.currency,
        notes: values.notes || null,
        lineItems: [
          {
            productId: values.productId || null,
            sku: values.sku || null,
            name: values.itemName,
            quantity,
            unitPriceCents
          }
        ]
      },
      {
        salesOrderStore: locals.salesOrderStore,
        actor: { id: locals.user.id, email: locals.user.email, permissions }
      }
    );
    if (!result.ok) return fail(result.status, { error: result.error.message, values });

    await recordEvent(
      {
        eventName: "sales-order.order_created",
        actorId: locals.user.id,
        entityType: "sales-order",
        entityId: result.data.order.id,
        source: "app/sales-orders",
        payload: { totalCents: result.data.order.totalCents, status: result.data.order.status }
      },
      { auditStore: locals.auditStore }
    );

    return { created: true };
  },

  confirm: async ({ request, locals, cookies, platform }) => {
    requireModule("sales-order", platform);
    requireModule("inventory", platform);
    requireModule("product-catalog", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    const { permissions } = await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const orderId = text(form.get("orderId"));
    if (!orderId) return fail(400, { error: "Missing sales order id." });

    let result;
    try {
      result = await confirmOrder(
        { tenantId: org.id, orderId },
        {
          salesOrderStore: locals.salesOrderStore,
          inventoryReservationPort: createSalesOrderInventoryReservationPort({
            inventoryStore: locals.inventoryStore,
            productCatalogStore: locals.productCatalogStore,
            actorId: locals.user.id,
            permissions
          }),
          actor: { id: locals.user.id, email: locals.user.email, permissions }
        }
      );
    } catch (error) {
      return fail(400, { error: error instanceof Error ? error.message : "Could not reserve stock for this sales order." });
    }
    if (!result.ok || !result.data) return fail(result.status, { error: result.error.message });

    await recordEvent(
      {
        eventName: "sales-order.order_confirmed",
        actorId: locals.user.id,
        entityType: "sales-order",
        entityId: result.data.order.id,
        source: "app/sales-orders",
        payload: {
          idempotent: result.data.idempotent,
          reservationId: result.data.order.inventoryReservationId,
          totalCents: result.data.order.totalCents,
          status: result.data.order.status
        }
      },
      { auditStore: locals.auditStore }
    );

    return { confirmed: true };
  },

  invoice: async ({ request, locals, cookies, platform }) => {
    requireModule("sales-order", platform);
    requireModule("invoice", platform);
    requireModule("inventory", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    const { permissions } = await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const orderId = text(form.get("orderId"));
    if (!orderId) return fail(400, { error: "Missing sales order id." });

    let result;
    let releaseSummary = { releasedCount: 0, idempotentCount: 0, movementIds: [] as string[] };
    try {
      result = await markOrderInvoiced(
        { tenantId: org.id, orderId },
        {
          salesOrderStore: locals.salesOrderStore,
          invoiceDraftPort: invoiceDraftPort(locals, locals.user.id, permissions),
          actor: { id: locals.user.id, email: locals.user.email, permissions }
        }
      );
      if (result.ok && result.data) {
        releaseSummary = await releaseSalesOrderReservations(result.data.order, {
          inventoryStore: locals.inventoryStore,
          productCatalogStore: locals.productCatalogStore,
          actorId: locals.user.id,
          permissions
        });
      }
    } catch (error) {
      return fail(400, { error: error instanceof Error ? error.message : "Could not create invoice draft." });
    }
    if (!result.ok || !result.data) return fail(result.status, { error: result.error.message });

    await recordEvent(
      {
        eventName: "sales-order.order_invoiced",
        actorId: locals.user.id,
        entityType: "sales-order",
        entityId: result.data.order.id,
        source: "app/sales-orders",
        payload: {
          idempotent: result.data.idempotent,
          invoiceId: result.data.order.invoiceId,
          releasedReservations: releaseSummary.releasedCount,
          idempotentReservationReleases: releaseSummary.idempotentCount,
          status: result.data.order.status
        }
      },
      { auditStore: locals.auditStore }
    );

    return { invoiced: true, invoiceId: result.data.order.invoiceId };
  },

  send: async ({ request, locals, cookies, platform }) => {
    requireModule("sales-order", platform);
    requireModule("email", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    const { permissions } = await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const orderId = text(form.get("orderId"));
    const message = text(form.get("message")) || null;
    if (!orderId) return fail(400, { error: "Missing sales order id." });

    const result = await sendSalesOrder(
      { tenantId: org.id, orderId, message },
      {
        salesOrderStore: locals.salesOrderStore,
        salesOrderDeliveryPort: salesOrderDeliveryPort(locals, org.name, locals.user.id, locals.user.email),
        actor: { id: locals.user.id, email: locals.user.email, permissions }
      }
    );
    if (!result.ok || !result.data) return fail(result.status, { error: result.error.message });

    await recordEvent(
      {
        eventName: "sales-order.order_sent",
        actorId: locals.user.id,
        entityType: "sales-order",
        entityId: result.data.order.id,
        source: "app/sales-orders",
        payload: {
          to: result.data.attempt.recipientEmail,
          emailDeliveryId: result.data.attempt.deliveryId,
          provider: result.data.attempt.provider,
          deliveryStatus: result.data.attempt.deliveryStatus
        }
      },
      { auditStore: locals.auditStore }
    );

    return { sent: true, recipient: result.data.attempt.recipientEmail };
  },

  cancel: async ({ request, locals, cookies, platform }) => {
    requireModule("sales-order", platform);
    requireModule("inventory", platform);
    if (!locals.user) return fail(403, { error: "Not signed in to a company." });
    const { org } = await loadCompanyContext(cookies, locals.user.id, locals.rbacStore);
    if (!org) return fail(403, { error: "Not signed in to a company." });
    const { permissions } = await requireOrgPermission(cookies, locals.user.id, org.id, "member.manage", locals.rbacStore);

    const form = await request.formData();
    const orderId = text(form.get("orderId"));
    const reason = text(form.get("reason")) || "Cancelled from sales order ledger.";
    if (!orderId) return fail(400, { error: "Missing sales order id." });

    let result;
    let releaseSummary = { releasedCount: 0, idempotentCount: 0, movementIds: [] as string[] };
    try {
      result = await cancelOrder(
        { tenantId: org.id, orderId, reason },
        {
          salesOrderStore: locals.salesOrderStore,
          actor: { id: locals.user.id, email: locals.user.email, permissions }
        }
      );
      if (result.ok && result.data) {
        releaseSummary = await releaseSalesOrderReservations(result.data.order, {
          inventoryStore: locals.inventoryStore,
          productCatalogStore: locals.productCatalogStore,
          actorId: locals.user.id,
          permissions
        });
      }
    } catch (error) {
      return fail(400, { error: error instanceof Error ? error.message : "Could not cancel this sales order." });
    }
    if (!result.ok || !result.data) return fail(result.status, { error: result.error.message });

    await recordEvent(
      {
        eventName: "sales-order.order_cancelled",
        actorId: locals.user.id,
        entityType: "sales-order",
        entityId: result.data.order.id,
        source: "app/sales-orders",
        payload: {
          idempotent: result.data.idempotent,
          releasedReservations: releaseSummary.releasedCount,
          idempotentReservationReleases: releaseSummary.idempotentCount,
          reason: result.data.order.cancelReason,
          status: result.data.order.status
        }
      },
      { auditStore: locals.auditStore }
    );

    return { cancelled: true };
  }
};
