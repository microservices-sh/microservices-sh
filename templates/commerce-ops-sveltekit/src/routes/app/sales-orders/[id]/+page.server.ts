import type { PageServerLoad } from "./$types";
import { error, redirect } from "@sveltejs/kit";
import { getCustomer } from "@microservices-sh/customer";
import { getOrder } from "@microservices-sh/sales-order";
import { money, relativeTime } from "$lib/format";
import { requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";
import type { Tone } from "$lib/ui/types";

const statusTone = (status: string): Tone =>
  status === "invoiced" ? "good" : status === "cancelled" ? "bad" : status === "confirmed" ? "warn" : "neutral";

export const load: PageServerLoad = async ({ params, locals, cookies, parent, platform }) => {
  requireModule("sales-order", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);
  const now = Date.now();

  const orderResult = await getOrder(
    { tenantId: activeOrgId, orderId: params.id },
    { salesOrderStore: locals.salesOrderStore }
  );
  if (!orderResult.ok || !orderResult.data) throw error(orderResult.status, orderResult.error.message);

  const order = orderResult.data.order;
  const customer = order.customerId
    ? await getCustomer({ id: order.customerId }, { customerRepository: locals.customerRepository })
    : null;
  const customerName =
    order.customerSnapshot?.displayName ??
    (customer?.ok && customer.data ? customer.data.customer.name : "Walk-in customer");

  return {
    order: {
      ...order,
      displayNumber: order.orderNumber ?? order.id,
      tone: statusTone(order.status),
      customerName,
      created: relativeTime(order.createdAt, now),
      confirmed: order.confirmedAt ? relativeTime(order.confirmedAt, now) : null,
      invoiced: order.invoicedAt ? relativeTime(order.invoicedAt, now) : null,
      cancelled: order.cancelledAt ? relativeTime(order.cancelledAt, now) : null,
      subtotal: money(order.subtotalCents, order.currency),
      discount: money(order.discountCents, order.currency),
      tax: money(order.taxCents, order.currency),
      total: money(order.totalCents, order.currency)
    }
  };
};
