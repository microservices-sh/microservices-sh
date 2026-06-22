import { bulkTransitionOrdersInputSchema } from "../schemas";
import type { Actor, SalesOrderBulkTransitionItem, SalesOrderBulkTransitionSummary } from "../types";
import { cancelOrder } from "./cancel-order";
import { confirmOrder } from "./confirm-order";
import { err, ok, type SalesOrderDeps } from "./shared";

export async function bulkTransitionOrders(input: unknown, deps: SalesOrderDeps & { actor?: Actor | null }) {
  const parsed = bulkTransitionOrdersInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "sales-order.INVALID_BULK_TRANSITION_INPUT", "Bulk transition input is invalid.", parsed.error.issues);
  }

  const { tenantId, orderIds, action, reason } = parsed.data;
  if (new Set(orderIds).size !== orderIds.length) {
    return err(400, "sales-order.DUPLICATE_ORDER_IDS", "Bulk transition order ids must be unique.");
  }

  const items: SalesOrderBulkTransitionItem[] = [];
  for (const orderId of orderIds) {
    const result =
      action === "confirm"
        ? await confirmOrder({ tenantId, orderId }, deps)
        : await cancelOrder({ tenantId, orderId, reason }, deps);

    if (result.ok) {
      items.push({
        orderId,
        ok: true,
        status: result.status,
        idempotent: result.data.idempotent,
        order: result.data.order
      });
      continue;
    }

    items.push({
      orderId,
      ok: false,
      status: result.status,
      error: result.error
    });
  }

  const succeededCount = items.filter((item) => item.ok).length;
  const failedCount = items.length - succeededCount;
  const summary: SalesOrderBulkTransitionSummary = {
    action,
    requestedCount: orderIds.length,
    succeededCount,
    failedCount,
    items
  };

  return ok(failedCount > 0 ? 207 : 200, summary);
}
