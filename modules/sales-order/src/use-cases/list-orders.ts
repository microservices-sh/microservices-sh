import { salesOrderFilterSchema } from "../schemas";
import { err, ok, type SalesOrderDeps } from "./shared";

export async function listOrders(input: unknown, deps: SalesOrderDeps) {
  const parsed = salesOrderFilterSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "sales-order.INVALID_ORDER_FILTER", "Sales order filter is invalid.", parsed.error.issues);
  }

  const orders = await deps.salesOrderStore.listOrders(parsed.data);
  return ok(200, { orders });
}
