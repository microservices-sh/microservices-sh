import { salesOrderIdentitySchema } from "../schemas";
import { err, ok, type SalesOrderDeps } from "./shared";

export async function getOrder(input: unknown, deps: SalesOrderDeps) {
  const parsed = salesOrderIdentitySchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "sales-order.INVALID_ORDER_IDENTITY", "Sales order identity is invalid.", parsed.error.issues);
  }

  const order = await deps.salesOrderStore.getOrder(parsed.data.tenantId, parsed.data.orderId);
  if (!order) return err(404, "sales-order.ORDER_NOT_FOUND", "Sales order not found.");

  return ok(200, { order });
}
