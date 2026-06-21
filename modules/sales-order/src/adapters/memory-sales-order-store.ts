import type { SalesOrderStore } from "../ports";
import type { SalesOrder, SalesOrderEvent, SalesOrderFilter, SalesOrderLineItem, SalesOrderWithLineItems } from "../types";

function cloneOrder(order: SalesOrder): SalesOrder {
  return {
    ...order,
    customerSnapshot: order.customerSnapshot ? { ...order.customerSnapshot } : null
  };
}

function cloneLineItem(lineItem: SalesOrderLineItem): SalesOrderLineItem {
  return { ...lineItem };
}

function withLineItems(order: SalesOrder, lineItems: SalesOrderLineItem[]): SalesOrderWithLineItems {
  return { ...cloneOrder(order), lineItems: lineItems.map(cloneLineItem) };
}

function matchesFilter(order: SalesOrder, filter: SalesOrderFilter): boolean {
  return (
    order.tenantId === filter.tenantId &&
    (!filter.status || order.status === filter.status) &&
    (!filter.customerId || order.customerId === filter.customerId) &&
    (!filter.externalSource || order.externalSource === filter.externalSource)
  );
}

export function createMemorySalesOrderStore(): SalesOrderStore {
  const orders = new Map<string, SalesOrder>();
  const lineItemsByOrder = new Map<string, SalesOrderLineItem[]>();
  const events: SalesOrderEvent[] = [];

  return {
    async insertOrder(order, lineItems) {
      orders.set(order.id, cloneOrder(order));
      lineItemsByOrder.set(order.id, lineItems.map(cloneLineItem));
    },

    async updateOrder(order) {
      if (orders.has(order.id)) orders.set(order.id, cloneOrder(order));
    },

    async getOrder(tenantId, orderId) {
      const order = orders.get(orderId);
      if (!order || order.tenantId !== tenantId) return null;
      return withLineItems(order, lineItemsByOrder.get(order.id) ?? []);
    },

    async findOrderByExternalRef(tenantId, externalSource, externalId) {
      const order = [...orders.values()].find(
        (candidate) =>
          candidate.tenantId === tenantId &&
          candidate.externalSource === externalSource &&
          candidate.externalId === externalId
      );
      return order ? withLineItems(order, lineItemsByOrder.get(order.id) ?? []) : null;
    },

    async listOrders(filter) {
      return [...orders.values()]
        .filter((order) => matchesFilter(order, filter))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, filter.limit ?? 100)
        .map((order) => withLineItems(order, lineItemsByOrder.get(order.id) ?? []));
    },

    async writeEvent(event) {
      events.push({ ...event, payload: { ...event.payload } });
    }
  };
}
