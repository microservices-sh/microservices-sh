// MCP server wiring for the commerce-ops app — the edit seam imported by the
// generated stdio server. Governance (scope gate, approval gate, audit) lives in
// the sdk gateway; this file binds generated tool names to module use cases.

import { rpcContract as authRpc } from "@microservices-sh/auth/rpc";
import { createMemorySigningKeyStore } from "@microservices-sh/auth/adapters/memory";

import {
  requestLoginCode,
  verifyLoginCode,
  readSession,
  destroySession
} from "@microservices-sh/identity/service";
import {
  createMemoryAccountStore,
  createMemoryLoginCodeStore,
  createMemorySessionStore
} from "@microservices-sh/identity/adapters/memory";

import { rpcContract as customerRpc } from "@microservices-sh/customer/rpc";
import { createMemoryCustomerRepository } from "@microservices-sh/customer/adapters/memory";

import {
  createUploadTicket,
  completeUpload,
  listFiles,
  deleteFile,
  createMemoryMediaStore,
  createMemoryObjectStorage
} from "@microservices-sh/file-media";

import {
  createTicket,
  getTicket,
  listTickets,
  updateTicket,
  addTicketComment,
  listTicketThread,
  attachTicketFile,
  createTicketShareToken,
  listTicketShareTokens,
  revokeTicketShareToken,
  resolveTicketShareToken,
  createMemoryTicketStore
} from "@microservices-sh/support-ticket";

import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  listCategories,
  createCategory,
  expandProductComponents,
  createMemoryProductCatalogStore
} from "@microservices-sh/product-catalog";

import {
  getStockBalance,
  listStockMovements,
  stockIn,
  reserveStock,
  releaseReservation,
  deductStock,
  reconcileStock,
  createMemoryInventoryStore
} from "@microservices-sh/inventory";

import {
  listOrders,
  getOrder,
  createDraftOrder,
  confirmOrder,
  cancelOrder,
  markOrderInvoiced,
  createMemorySalesOrderStore
} from "@microservices-sh/sales-order";

import {
  createInvoice,
  issueInvoice,
  createMemoryInvoiceStore,
  createMemoryNumberAllocator
} from "@microservices-sh/invoice";

import {
  listShipments,
  getShipment,
  createShipment,
  startShipmentProcessing,
  completeShipment,
  cancelShipment,
  listShipmentStatusTransitions,
  createMemoryShipmentStore
} from "@microservices-sh/shipment";

import { recordEvent } from "@microservices-sh/audit-log";
import { createMemoryAuditEventStore } from "@microservices-sh/audit-log/adapters/memory";
import {
  createSalesOrderInventoryReservationPort,
  releaseSalesOrderReservations
} from "./sales-order-inventory";
import { createShipmentInventoryPort } from "./shipment-inventory";

type ToolContext = { actor?: string; scopes?: string[]; confirmed?: boolean };

const signingKeyStore = createMemorySigningKeyStore();
const identityDeps = {
  accountStore: createMemoryAccountStore(),
  loginCodeStore: createMemoryLoginCodeStore(),
  sessionStore: createMemorySessionStore()
};
const customerRepository = createMemoryCustomerRepository();
const fileMediaDeps = { mediaStore: createMemoryMediaStore(), storage: createMemoryObjectStorage() };
const ticketStore = createMemoryTicketStore();
const productCatalogStore = createMemoryProductCatalogStore();
const inventoryStore = createMemoryInventoryStore();
const salesOrderStore = createMemorySalesOrderStore();
const invoiceStore = createMemoryInvoiceStore();
const numberAllocator = createMemoryNumberAllocator();
const shipmentStore = createMemoryShipmentStore();
const auditStore = createMemoryAuditEventStore();

function actor(ctx?: ToolContext) {
  return { id: ctx?.actor ?? process.env.MCP_AGENT_ID ?? "agent:commerce-ops" };
}

const productReader = {
  getProduct: (tenantId: string, productId: string) => productCatalogStore.getProduct(tenantId, productId)
};

function permissions(ctx?: ToolContext): string[] {
  return ctx?.scopes ?? [];
}

function actorWithPermissions(ctx?: ToolContext) {
  return { ...actor(ctx), permissions: permissions(ctx) };
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

function invoiceDraftPort(ctx?: ToolContext) {
  return {
    async createDraftFromSalesOrder({ order }: { order: Awaited<ReturnType<typeof salesOrderStore.getOrder>> extends infer T ? NonNullable<T> : never }) {
      if (!order.customerId) {
        throw new Error("Sales order needs a customerId before an MCP invoice handoff can create an invoice.");
      }

      const created = await createInvoice(
        {
          tenantId: order.tenantId,
          customerId: order.customerId,
          currency: order.currency,
          series: "INV",
          notes: `Sales order ${order.orderNumber ?? order.id}${order.notes ? ` - ${order.notes}` : ""}`,
          lineItems: order.lineItems.map(orderLineToInvoiceLine)
        },
        { invoiceStore }
      );
      if (!created.ok || !created.data) throw new Error(created.ok ? "Could not create invoice." : created.error.message);

      const issued = await issueInvoice(
        { invoiceId: created.data.id, termsDays: 14 },
        { invoiceStore, allocator: numberAllocator }
      );
      if (!issued.ok || !issued.data) throw new Error(issued.ok ? "Could not issue invoice." : issued.error.message);

      await recordEvent(
        {
          eventName: "invoice.issued",
          actorId: actor(ctx).id,
          entityType: "invoice",
          entityId: created.data.id,
          source: "agent-mcp",
          payload: { number: issued.data.number, customerId: order.customerId, salesOrderId: order.id }
        },
        { auditStore }
      );

      return { invoiceId: created.data.id, invoiceNumber: issued.data.number };
    }
  };
}

async function confirmSalesOrder(input: unknown, ctx?: ToolContext) {
  return confirmOrder(input, {
    salesOrderStore,
    inventoryReservationPort: createSalesOrderInventoryReservationPort({
      inventoryStore,
      productCatalogStore,
      actorId: actor(ctx).id,
      permissions: permissions(ctx)
    }),
    actor: actorWithPermissions(ctx)
  });
}

async function cancelSalesOrder(input: unknown, ctx?: ToolContext) {
  const result = await cancelOrder(input, { salesOrderStore, actor: actorWithPermissions(ctx) });
  if (result.ok && result.data) {
    await releaseSalesOrderReservations(result.data.order, {
      inventoryStore,
      productCatalogStore,
      actorId: actor(ctx).id,
      permissions: permissions(ctx)
    });
  }
  return result;
}

async function invoiceSalesOrder(input: unknown, ctx?: ToolContext) {
  const result = await markOrderInvoiced(input, {
    salesOrderStore,
    invoiceDraftPort: invoiceDraftPort(ctx),
    actor: actorWithPermissions(ctx)
  });
  if (result.ok && result.data) {
    await releaseSalesOrderReservations(result.data.order, {
      inventoryStore,
      productCatalogStore,
      actorId: actor(ctx).id,
      permissions: permissions(ctx)
    });
  }
  return result;
}

async function completeCommerceShipment(input: unknown, ctx?: ToolContext) {
  return completeShipment(input, {
    shipmentStore,
    inventoryPort: createShipmentInventoryPort({
      inventoryStore,
      productCatalogStore,
      salesOrderStore,
      actorId: actor(ctx).id
    }),
    actor: actor(ctx)
  });
}

export const schemas: Record<string, unknown> = {};

export const handlers: Record<string, (input: unknown, ctx?: ToolContext) => Promise<unknown>> = {
  auth_mintToken: (input) => authRpc.mintToken.handler(input, { signingKeyStore }),
  auth_verifyToken: (input) => authRpc.verifyToken.handler(input, { signingKeyStore }),
  auth_getJwks: (input) => authRpc.getJwks.handler(input, { signingKeyStore }),

  identity_requestLoginCode: (input) => requestLoginCode(input, identityDeps),
  identity_verifyLoginCode: (input) => verifyLoginCode(input, identityDeps),
  identity_readSession: (input) => readSession(input as { sessionId?: string | null }, identityDeps),
  identity_destroySession: (input) => destroySession(input as { sessionId?: string }, identityDeps),

  customer_getCustomer: (input) => customerRpc.getCustomer.handler(input, { customerRepository }),
  customer_listCustomers: (input) => customerRpc.listCustomers.handler(input, { customerRepository }),
  customer_upsertCustomer: (input) => customerRpc.upsertCustomer.handler(input, { customerRepository }),

  "file-media_createUploadTicket": (input) => createUploadTicket(input, fileMediaDeps),
  "file-media_completeUpload": (input) => completeUpload(input, fileMediaDeps),
  "file-media_listFiles": (input) => listFiles(input, fileMediaDeps),
  "file-media_deleteFile": (input) => deleteFile(input, fileMediaDeps),

  "support-ticket_createTicket": (input) => createTicket(input, { store: ticketStore }),
  "support-ticket_getTicket": (input) => getTicket(input, { store: ticketStore }),
  "support-ticket_listTickets": (input) => listTickets(input, { store: ticketStore }),
  "support-ticket_updateTicket": (input) => updateTicket(input, { store: ticketStore }),
  "support-ticket_addTicketComment": (input) => addTicketComment(input, { store: ticketStore }),
  "support-ticket_listTicketThread": (input) => listTicketThread(input, { store: ticketStore }),
  "support-ticket_attachTicketFile": (input) => attachTicketFile(input, { store: ticketStore }),
  "support-ticket_createTicketShareToken": (input) => createTicketShareToken(input, { store: ticketStore }),
  "support-ticket_listTicketShareTokens": (input) => listTicketShareTokens(input, { store: ticketStore }),
  "support-ticket_revokeTicketShareToken": (input) => revokeTicketShareToken(input, { store: ticketStore }),
  "support-ticket_resolveTicketShareToken": (input) => resolveTicketShareToken(input, { store: ticketStore }),

  "product-catalog_listProducts": (input) => listProducts(input, { productCatalogStore }),
  "product-catalog_getProduct": (input) => getProduct(input, { productCatalogStore }),
  "product-catalog_createProduct": (input, ctx) => createProduct(input, { productCatalogStore, actor: actor(ctx) }),
  "product-catalog_updateProduct": (input, ctx) => updateProduct(input, { productCatalogStore, actor: actor(ctx) }),
  "product-catalog_listCategories": (input) => listCategories(input, { productCatalogStore }),
  "product-catalog_createCategory": (input, ctx) => createCategory(input, { productCatalogStore, actor: actor(ctx) }),
  "product-catalog_expandProductComponents": (input) => expandProductComponents(input, { productCatalogStore }),

  inventory_getStockBalance: (input) => getStockBalance(input, { inventoryStore, productReader }),
  inventory_listStockMovements: (input) => listStockMovements(input, { inventoryStore }),
  inventory_stockIn: (input, ctx) => stockIn(input, { inventoryStore, productReader, actor: actor(ctx) }),
  inventory_reserveStock: (input, ctx) => reserveStock(input, { inventoryStore, productReader, actor: actor(ctx) }),
  inventory_releaseReservation: (input, ctx) =>
    releaseReservation(input, { inventoryStore, productReader, actor: actor(ctx) }),
  inventory_deductStock: (input, ctx) => deductStock(input, { inventoryStore, productReader, actor: actor(ctx) }),
  inventory_reconcileStock: (input, ctx) => reconcileStock(input, { inventoryStore, productReader, actor: actor(ctx) }),

  "sales-order_listOrders": (input) => listOrders(input, { salesOrderStore }),
  "sales-order_getOrder": (input) => getOrder(input, { salesOrderStore }),
  "sales-order_createDraftOrder": (input, ctx) => createDraftOrder(input, { salesOrderStore, actor: actorWithPermissions(ctx) }),
  "sales-order_confirmOrder": (input, ctx) => confirmSalesOrder(input, ctx),
  "sales-order_cancelOrder": (input, ctx) => cancelSalesOrder(input, ctx),
  "sales-order_markOrderInvoiced": (input, ctx) => invoiceSalesOrder(input, ctx),

  shipment_listShipments: (input) => listShipments(input, { shipmentStore }),
  shipment_getShipment: (input) => getShipment(input, { shipmentStore }),
  shipment_createShipment: (input, ctx) => createShipment(input, { shipmentStore, actor: actor(ctx) }),
  shipment_startShipmentProcessing: (input, ctx) => startShipmentProcessing(input, { shipmentStore, actor: actor(ctx) }),
  shipment_completeShipment: (input, ctx) => completeCommerceShipment(input, ctx),
  shipment_cancelShipment: (input, ctx) => cancelShipment(input, { shipmentStore, actor: actor(ctx) }),
  shipment_listShipmentStatusTransitions: (input) => listShipmentStatusTransitions(input, { shipmentStore })
};

export function authorize(ctx: { scopes?: string[] } | undefined, scope: string | null): boolean {
  if (!scope) return true;
  return (ctx?.scopes ?? []).includes(scope);
}

export const audit = {
  record: (e: {
    tool: string;
    outcome: string;
    actor?: string;
    method?: string;
    module?: string;
    mutation?: boolean;
  }) =>
    recordEvent(
      {
        eventName: `tool.${e.outcome}`,
        actorId: e.actor ?? "agent",
        entityType: "tool",
        entityId: e.tool,
        source: "agent-mcp",
        payload: { method: e.method, module: e.module, mutation: e.mutation }
      },
      { auditStore }
    )
};

export function actorContext(): { actor: string; scopes: string[] } {
  const scopes = (process.env.MCP_AGENT_SCOPES ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return { actor: process.env.MCP_AGENT_ID ?? "agent:commerce-ops", scopes };
}
