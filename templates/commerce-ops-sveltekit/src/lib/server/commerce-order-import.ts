import { upsertCustomer } from "@microservices-sh/customer";
import { cancelOrder, confirmOrder, createDraftOrder } from "@microservices-sh/sales-order";
import type {
  NormalizedCommerceAddress,
  NormalizedCommerceEnvelope,
  NormalizedCommerceOrderLine,
  NormalizedCommerceOrderPayload,
  ProviderMapping
} from "@microservices-sh/commerce-sync";
import type { Product } from "@microservices-sh/product-catalog";
import type { SalesOrderStatus, SalesOrderWithLineItems } from "@microservices-sh/sales-order";
import {
  createSalesOrderInventoryReservationPort,
  releaseSalesOrderReservations
} from "./sales-order-inventory";

type Actor = { id: string; email?: string; permissions?: string[] };

export interface CommerceOrderImportDeps {
  commerceSyncService: App.Locals["commerceSyncService"];
  customerRepository: App.Locals["customerRepository"];
  productCatalogStore: App.Locals["productCatalogStore"];
  inventoryStore?: App.Locals["inventoryStore"];
  salesOrderStore: App.Locals["salesOrderStore"];
  actor: Actor;
}

export interface CommerceOrderImportResult {
  orderId: string;
  orderNumber: string | null;
  created: boolean;
  customerId: string | null;
  lineCount: number;
  status: SalesOrderStatus;
  mappedStatus: NormalizedCommerceOrderPayload["mappedStatus"];
}

function isWooCommerceOrderPayload(value: unknown): value is NormalizedCommerceOrderPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as NormalizedCommerceOrderPayload).provider === "woocommerce" &&
    (value as NormalizedCommerceOrderPayload).resourceType === "order"
  );
}

function formatAddress(address: NormalizedCommerceAddress | undefined): string | null {
  if (!address) return null;
  return [
    address.name,
    address.company,
    address.address1,
    address.address2,
    [address.city, address.state, address.postalCode].filter(Boolean).join(", "),
    address.country
  ]
    .filter(Boolean)
    .join("\n") || null;
}

function customerName(order: NormalizedCommerceOrderPayload): string {
  return order.billingAddress?.name ?? order.shippingAddress?.name ?? order.billingAddress?.email ?? `WooCommerce customer ${order.externalId}`;
}

function orderExternalSource(connectionId: string): string {
  return `woocommerce:${connectionId}`;
}

function findMapping(
  mappings: ProviderMapping[],
  connectionId: string,
  resourceType: ProviderMapping["resourceType"],
  externalId: string | undefined
): ProviderMapping | null {
  if (!externalId) return null;
  return mappings.find((mapping) => mapping.connectionId === connectionId && mapping.resourceType === resourceType && mapping.externalId === externalId) ?? null;
}

async function recordProviderMapping(deps: CommerceOrderImportDeps, ctx: { tenantId: string; connectionId: string }, input: {
  resourceType: ProviderMapping["resourceType"];
  externalId: string;
  internalId: string;
}): Promise<void> {
  const mapping = await deps.commerceSyncService.recordProviderMapping(
    { tenantId: ctx.tenantId, actorId: deps.actor.id },
    {
      connectionId: ctx.connectionId,
      resourceType: input.resourceType,
      externalId: input.externalId,
      internalId: input.internalId
    }
  );
  if (!mapping.ok) throw new Error(mapping.error?.message ?? "Could not record WooCommerce provider mapping.");
}

async function resolveCustomerId(
  order: NormalizedCommerceOrderPayload,
  envelope: NormalizedCommerceEnvelope,
  mappings: ProviderMapping[],
  deps: CommerceOrderImportDeps
): Promise<string | null> {
  const mapped = findMapping(mappings, envelope.connectionId, "customer", order.customerExternalId);
  if (mapped) return mapped.internalId;

  const email = order.billingAddress?.email ?? order.shippingAddress?.email;
  if (!email) return null;

  const customer = await upsertCustomer(
    {
      name: customerName(order),
      email,
      phone: order.billingAddress?.phone ?? order.shippingAddress?.phone,
      notes: `Imported from WooCommerce order ${order.externalId}.`
    },
    { customerRepository: deps.customerRepository, actor: deps.actor }
  );
  if (!customer.ok || !customer.data) throw new Error(customer.ok ? "Could not upsert WooCommerce customer." : customer.error.message);

  if (order.customerExternalId) {
    await recordProviderMapping(deps, envelope, {
      resourceType: "customer",
      externalId: order.customerExternalId,
      internalId: customer.data.customer.id
    });
  }

  return customer.data.customer.id;
}

async function resolveProductForLine(
  tenantId: string,
  connectionId: string,
  line: NormalizedCommerceOrderLine,
  mappings: ProviderMapping[],
  deps: CommerceOrderImportDeps
): Promise<Product | null> {
  const mapped = findMapping(mappings, connectionId, "product", line.productExternalId);
  if (mapped) return deps.productCatalogStore.getProduct(tenantId, mapped.internalId);

  const byConnectionExternalRef = line.productExternalId
    ? await deps.productCatalogStore.findProductByExternalRef(tenantId, orderExternalSource(connectionId), line.productExternalId)
    : null;
  const byProviderExternalRef = !byConnectionExternalRef && line.productExternalId
    ? await deps.productCatalogStore.findProductByExternalRef(tenantId, "woocommerce", line.productExternalId)
    : null;
  const bySku = !byConnectionExternalRef && !byProviderExternalRef && line.sku
    ? await deps.productCatalogStore.findProductBySku(tenantId, line.sku)
    : null;

  const product = byConnectionExternalRef ?? byProviderExternalRef ?? bySku;
  if (product && line.productExternalId) {
    await recordProviderMapping(
      deps,
      { tenantId, connectionId },
      {
        resourceType: "product",
        externalId: line.productExternalId,
        internalId: product.id
      }
    );
  }
  return product;
}

function lineDiscountCents(line: NormalizedCommerceOrderLine): number {
  const calculatedSubtotal = line.quantity * line.unitPriceCents;
  return Math.max(0, calculatedSubtotal - line.totalCents);
}

function importNotes(order: NormalizedCommerceOrderPayload): string {
  const coupons = order.couponLines.length ? ` Coupons: ${order.couponLines.map((coupon) => coupon.code).join(", ")}.` : "";
  return `Imported WooCommerce order ${order.externalId} (${order.status}). Source total ${(order.totalCents / 100).toFixed(2)} ${order.currency}.${coupons}`;
}

function importResultFromOrder(
  order: SalesOrderWithLineItems,
  created: boolean,
  mappedStatus: NormalizedCommerceOrderPayload["mappedStatus"]
): CommerceOrderImportResult {
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    created,
    customerId: order.customerId,
    lineCount: order.lineItems.length,
    status: order.status,
    mappedStatus
  };
}

async function applyImportedLifecycleStatus(
  imported: SalesOrderWithLineItems,
  sourceOrder: NormalizedCommerceOrderPayload,
  deps: CommerceOrderImportDeps
): Promise<SalesOrderWithLineItems> {
  if (sourceOrder.mappedStatus === "draft") return imported;

  if (sourceOrder.mappedStatus === "cancelled") {
    const cancelled = await cancelOrder(
      {
        tenantId: imported.tenantId,
        orderId: imported.id,
        reason: `WooCommerce status ${sourceOrder.status}`
      },
      { salesOrderStore: deps.salesOrderStore, actor: deps.actor }
    );
    if (!cancelled.ok || !cancelled.data) {
      throw new Error(cancelled.ok ? "Could not cancel WooCommerce sales order." : cancelled.error.message);
    }
    if (deps.inventoryStore) {
      await releaseSalesOrderReservations(cancelled.data.order, {
        inventoryStore: deps.inventoryStore,
        productCatalogStore: deps.productCatalogStore,
        actorId: deps.actor.id,
        permissions: deps.actor.permissions ?? []
      });
    }
    return cancelled.data.order;
  }

  const confirmed = await confirmOrder(
    { tenantId: imported.tenantId, orderId: imported.id },
    {
      salesOrderStore: deps.salesOrderStore,
      inventoryReservationPort: deps.inventoryStore
        ? createSalesOrderInventoryReservationPort({
            inventoryStore: deps.inventoryStore,
            productCatalogStore: deps.productCatalogStore,
            actorId: deps.actor.id,
            permissions: deps.actor.permissions ?? []
          })
        : undefined,
      actor: deps.actor
    }
  );
  if (!confirmed.ok || !confirmed.data) {
    throw new Error(confirmed.ok ? "Could not confirm WooCommerce sales order." : confirmed.error.message);
  }

  // WooCommerce `completed` maps to `invoiced`; the import bridge confirms and
  // reserves stock now, leaving invoice creation to the invoice/AR handoff slice.
  return confirmed.data.order;
}

export async function importWooCommerceOrderEnvelope(
  envelope: NormalizedCommerceEnvelope,
  deps: CommerceOrderImportDeps
): Promise<CommerceOrderImportResult> {
  if (!isWooCommerceOrderPayload(envelope.payload)) {
    throw new Error("Normalized commerce envelope is not a WooCommerce order.");
  }

  const order = envelope.payload;
  const source = orderExternalSource(envelope.connectionId);
  const existing = await deps.salesOrderStore.findOrderByExternalRef(envelope.tenantId, source, order.externalId);
  if (existing) {
    return importResultFromOrder(await applyImportedLifecycleStatus(existing, order, deps), false, order.mappedStatus);
  }

  const mappingsResult = await deps.commerceSyncService.listProviderMappings({ tenantId: envelope.tenantId });
  if (!mappingsResult.ok || !mappingsResult.data) {
    throw new Error(mappingsResult.ok ? "Could not load WooCommerce provider mappings." : mappingsResult.error.message);
  }
  const mappings = mappingsResult.data;
  const mappedOrder = findMapping(mappings, envelope.connectionId, "order", order.externalId);
  if (mappedOrder) {
    const mappedExisting = await deps.salesOrderStore.getOrder(envelope.tenantId, mappedOrder.internalId);
    if (mappedExisting) {
      return importResultFromOrder(await applyImportedLifecycleStatus(mappedExisting, order, deps), false, order.mappedStatus);
    }
  }

  const customerId = await resolveCustomerId(order, envelope, mappings, deps);
  const lineItems = await Promise.all(
    order.lineItems.map(async (line) => {
      const product = await resolveProductForLine(envelope.tenantId, envelope.connectionId, line, mappings, deps);
      return {
        productId: product?.id ?? null,
        sku: product?.sku ?? line.sku ?? null,
        name: line.name,
        quantity: Math.max(1, Math.floor(line.quantity)),
        unitPriceCents: line.unitPriceCents,
        discountCents: lineDiscountCents(line),
        externalId: line.externalLineId,
        externalSource: source
      };
    })
  );

  for (const shipping of order.shippingLines) {
    if (shipping.totalCents <= 0) continue;
    lineItems.push({
      productId: null,
      sku: null,
      name: `Shipping: ${shipping.methodTitle}`,
      quantity: 1,
      unitPriceCents: shipping.totalCents,
      discountCents: 0,
      externalId: shipping.externalLineId,
      externalSource: source
    });
  }

  if (lineItems.length === 0) {
    lineItems.push({
      productId: null,
      sku: null,
      name: `WooCommerce order ${order.externalId}`,
      quantity: 1,
      unitPriceCents: order.totalCents,
      discountCents: 0,
      externalId: order.externalId,
      externalSource: source
    });
  }

  const draft = await createDraftOrder(
    {
      tenantId: envelope.tenantId,
      customerId,
      customerSnapshot: {
        displayName: customerName(order),
        email: order.billingAddress?.email ?? order.shippingAddress?.email ?? null,
        phone: order.billingAddress?.phone ?? order.shippingAddress?.phone ?? null,
        billingAddress: formatAddress(order.billingAddress),
        shippingAddress: formatAddress(order.shippingAddress),
        taxId: null
      },
      externalId: order.externalId,
      externalSource: source,
      currency: order.currency,
      notes: importNotes(order),
      lineItems
    },
    {
      salesOrderStore: deps.salesOrderStore,
      actor: deps.actor
    }
  );
  if (!draft.ok || !draft.data) throw new Error(draft.ok ? "Could not create WooCommerce sales order draft." : draft.error.message);
  const importedOrder = await applyImportedLifecycleStatus(draft.data.order, order, deps);

  await recordProviderMapping(deps, envelope, {
    resourceType: "order",
    externalId: order.externalId,
    internalId: importedOrder.id
  });

  return importResultFromOrder(importedOrder, true, order.mappedStatus);
}
