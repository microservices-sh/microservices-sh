import { sendSalesOrderInputSchema } from "../schemas";
import { salesOrderId, isoNow } from "../service";
import type { Actor, SalesOrder, SalesOrderDeliveryResult, SalesOrderSendAttempt } from "../types";
import { err, hooks, ok, type SalesOrderDeps } from "./shared";

function defaultSubject(order: SalesOrder): string {
  return `Sales order ${order.orderNumber ?? order.id}`;
}

function deliveryStatus(result: SalesOrderDeliveryResult | null): string {
  return result?.status?.trim() || "queued";
}

function deliveryError(error: unknown): { errorCode: string; errorMessage: string } {
  if (error instanceof Error) {
    return { errorCode: "sales-order.DELIVERY_FAILED", errorMessage: error.message };
  }
  return { errorCode: "sales-order.DELIVERY_FAILED", errorMessage: "Sales order delivery failed." };
}

export async function sendSalesOrder(input: unknown, deps: SalesOrderDeps & { actor?: Actor | null }) {
  const parsed = sendSalesOrderInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, "sales-order.INVALID_SEND_INPUT", "Sales order send input is invalid.", parsed.error.issues);
  }

  const existing = await deps.salesOrderStore.getOrder(parsed.data.tenantId, parsed.data.orderId);
  if (!existing) return err(404, "sales-order.ORDER_NOT_FOUND", "Sales order not found.");
  if (existing.status === "cancelled") {
    return err(409, "sales-order.ORDER_NOT_SENDABLE", "Cancelled sales orders cannot be sent.");
  }

  const filtered = await hooks(deps).beforeSalesOrderSend(input, existing);
  const reparsed = sendSalesOrderInputSchema.safeParse(filtered);
  if (!reparsed.success) {
    return err(400, "sales-order.INVALID_SEND_INPUT", "Sales order send input is invalid.", reparsed.error.issues);
  }

  const idempotencyKey = reparsed.data.idempotencyKey ?? null;
  if (idempotencyKey) {
    const prior = await deps.salesOrderStore.findSendAttemptByIdempotencyKey(existing.tenantId, idempotencyKey);
    if (prior) return ok(200, { order: existing, attempt: prior, idempotent: true });
  }

  const recipientEmail = reparsed.data.toEmail ?? existing.customerSnapshot?.email ?? null;
  if (!recipientEmail) {
    return err(400, "sales-order.RECIPIENT_EMAIL_REQUIRED", "A recipient email address is required to send this sales order.");
  }
  if (!deps.salesOrderDeliveryPort) {
    return err(424, "sales-order.DELIVERY_PORT_REQUIRED", "A sales order delivery port is required to send sales orders.");
  }

  const now = isoNow(deps.now);
  const subject = reparsed.data.subject ?? defaultSubject(existing);
  const message = reparsed.data.message ?? null;
  let delivery: SalesOrderDeliveryResult | null = null;
  let failed: { errorCode: string; errorMessage: string } | null = null;

  try {
    delivery = await deps.salesOrderDeliveryPort.sendSalesOrder({
      order: existing,
      toEmail: recipientEmail,
      subject,
      message,
      idempotencyKey
    });
    if (deliveryStatus(delivery) === "failed") {
      failed = {
        errorCode: delivery.errorCode ?? "sales-order.DELIVERY_FAILED",
        errorMessage: delivery.errorMessage ?? "Sales order delivery failed."
      };
    }
  } catch (error) {
    failed = deliveryError(error);
    delivery = {
      status: "failed",
      errorCode: failed.errorCode,
      errorMessage: failed.errorMessage
    };
  }

  const attempt: SalesOrderSendAttempt = {
    id: salesOrderId("so_send"),
    tenantId: existing.tenantId,
    orderId: existing.id,
    recipientEmail,
    subject,
    message,
    provider: delivery?.provider ?? null,
    deliveryId: delivery?.deliveryId ?? null,
    deliveryStatus: failed ? "failed" : deliveryStatus(delivery),
    idempotencyKey,
    errorCode: failed?.errorCode ?? null,
    errorMessage: failed?.errorMessage ?? null,
    createdById: deps.actor?.id ?? null,
    createdAt: now
  };
  await deps.salesOrderStore.insertSendAttempt(attempt);

  const order = {
    ...existing,
    lastSentAt: now,
    lastSentToEmail: recipientEmail,
    lastSendStatus: attempt.deliveryStatus,
    lastEmailDeliveryId: attempt.deliveryId,
    updatedAt: now
  };
  await deps.salesOrderStore.updateOrder(order);
  await deps.salesOrderStore.writeEvent({
    eventName: failed ? "sales-order.order_send_failed" : "sales-order.order_sent",
    entityType: "sales-order",
    entityId: order.id,
    tenantId: order.tenantId,
    payload: {
      recipientEmail,
      provider: attempt.provider,
      deliveryId: attempt.deliveryId,
      deliveryStatus: attempt.deliveryStatus,
      idempotencyKey,
      errorCode: attempt.errorCode
    }
  });
  await hooks(deps).afterSalesOrderUpdated({ ...order, lineItems: existing.lineItems });

  if (failed) {
    return err(502, failed.errorCode, failed.errorMessage);
  }

  return ok(202, { order: { ...order, lineItems: existing.lineItems }, attempt, idempotent: false });
}
