import type { RequestHandler } from "./$types";
import { json } from "@sveltejs/kit";
import { recordEvent } from "@microservices-sh/audit-log";
import { verifyWooCommerceWebhookSignature } from "@microservices-sh/commerce-sync";
import type { CommerceResourceType } from "@microservices-sh/commerce-sync";
import { importWooCommerceOrderEnvelope } from "$lib/server/commerce-order-import";
import { requireModule } from "$lib/server/modules";

const MAX_WEBHOOK_BYTES = 1024 * 1024;

function header(request: Request, name: string): string {
  return request.headers.get(name)?.trim() ?? "";
}

function stringValue(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function objectPayload(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function webhookTopic(request: Request): string {
  return header(request, "x-wc-webhook-topic") || header(request, "x-wc-webhook-event") || "woocommerce.webhook";
}

function webhookResource(request: Request, topic: string): CommerceResourceType | null {
  const resource = header(request, "x-wc-webhook-resource").toLowerCase();
  if (resource === "order" || topic.toLowerCase().includes("order")) return "order";
  if (resource === "product" || topic.toLowerCase().includes("product")) return "product";
  if (resource === "customer" || topic.toLowerCase().includes("customer")) return "customer";
  if (resource === "coupon" || resource === "category") return "category";
  return null;
}

async function idempotencyKey(request: Request, tenantId: string, connectionId: string, topic: string, rawPayload: string): Promise<string> {
  const deliveryId = header(request, "x-wc-webhook-delivery-id") || header(request, "x-wc-webhook-id");
  if (deliveryId) return `woocommerce:${tenantId}:${connectionId}:${topic}:${deliveryId}`;
  return `woocommerce:${tenantId}:${connectionId}:${topic}:${await sha256Hex(rawPayload)}`;
}

function webhookSecret(env: App.Platform["env"] | undefined): string {
  return env?.WOOCOMMERCE_WEBHOOK_SECRET?.trim() ?? "";
}

export const POST: RequestHandler = async ({ request, params, platform, locals }) => {
  requireModule("commerce-sync", platform);
  requireModule("sales-order", platform);
  requireModule("customer", platform);
  requireModule("product-catalog", platform);

  const tenantId = params.tenantId?.trim();
  const connectionId = params.connectionId?.trim();
  if (!tenantId || !connectionId) {
    return json({ ok: false, error: "Missing WooCommerce webhook tenant or connection id." }, { status: 400 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_WEBHOOK_BYTES) {
    return json({ ok: false, error: "WooCommerce webhook payload is too large." }, { status: 413 });
  }

  const rawPayload = await request.text();
  if (new TextEncoder().encode(rawPayload).byteLength > MAX_WEBHOOK_BYTES) {
    return json({ ok: false, error: "WooCommerce webhook payload is too large." }, { status: 413 });
  }
  const signature = header(request, "x-wc-webhook-signature");
  const secret = webhookSecret(platform?.env);
  if (!secret) {
    return json({ ok: false, error: "WooCommerce webhook secret is not configured." }, { status: 503 });
  }
  const signatureVerified = await verifyWooCommerceWebhookSignature(rawPayload, signature, secret);
  if (!signatureVerified) {
    return json({ ok: false, error: "WooCommerce webhook signature verification failed." }, { status: 401 });
  }

  const topic = webhookTopic(request);
  const resourceType = webhookResource(request, topic);
  let payload: unknown;
  try {
    payload = JSON.parse(rawPayload);
  } catch {
    return json({ ok: false, error: "WooCommerce webhook payload must be valid JSON." }, { status: 400 });
  }

  const ctx = { tenantId, actorId: "woocommerce-webhook" };
  const connections = await locals.commerceSyncService.listCommerceConnections(ctx);
  const connection = connections.ok ? connections.data?.find((item) => item.id === connectionId && item.provider === "woocommerce" && item.active) : null;
  if (!connection) {
    return json({ ok: false, error: "WooCommerce connection was not found for this company." }, { status: 404 });
  }

  const key = await idempotencyKey(request, tenantId, connectionId, topic, rawPayload);
  const receipt = await locals.commerceSyncService.recordWebhookReceipt(ctx, {
    connectionId,
    topic,
    idempotencyKey: key,
    signature,
    payload
  });
  if (!receipt.ok || !receipt.data) {
    return json({ ok: false, error: receipt.error?.message ?? "Could not record WooCommerce webhook receipt." }, { status: 400 });
  }

  await recordEvent(
    {
      eventName: "commerce-sync.webhook_recorded",
      actorId: "woocommerce-webhook",
      entityType: "commerce_webhook_receipt",
      entityId: receipt.data.id,
      source: "api/commerce-sync/woocommerce",
      payload: { tenantId, connectionId, topic, replayed: receipt.data.replayed, signatureVerified }
    },
    { auditStore: locals.auditStore }
  );

  if (receipt.data.replayed && resourceType !== "order") {
    return json({ ok: true, replayed: true, receiptId: receipt.data.id }, { status: 200 });
  }

  if (resourceType !== "order") {
    return json({ ok: true, accepted: true, receiptId: receipt.data.id, imported: false, reason: "unsupported_resource" }, { status: 202 });
  }

  const externalId = stringValue(objectPayload(payload)?.id);
  if (!externalId) {
    return json({ ok: false, error: "WooCommerce order webhook payload is missing id." }, { status: 400 });
  }

  const envelope = await locals.commerceSyncService.normalizeCommercePayload(ctx, {
    connectionId,
    resourceType,
    externalId,
    payload
  });
  if (!envelope.ok || !envelope.data) {
    return json({ ok: false, error: envelope.error?.message ?? "Could not normalize WooCommerce order payload." }, { status: 400 });
  }

  try {
    const imported = await importWooCommerceOrderEnvelope(envelope.data, {
      commerceSyncService: locals.commerceSyncService,
      customerRepository: locals.customerRepository,
      productCatalogStore: locals.productCatalogStore,
      inventoryStore: locals.inventoryStore,
      salesOrderStore: locals.salesOrderStore,
      actor: { id: "woocommerce-webhook", permissions: ["inventory.write"] }
    });

    await recordEvent(
      {
        eventName: imported.created ? "commerce-sync.order_imported" : "commerce-sync.order_replayed",
        actorId: "woocommerce-webhook",
        entityType: "sales_order",
        entityId: imported.orderId,
        source: "api/commerce-sync/woocommerce",
        payload: {
          tenantId,
          connectionId,
          externalId,
          created: imported.created,
          lineCount: imported.lineCount,
          status: imported.status,
          mappedStatus: imported.mappedStatus
        }
      },
      { auditStore: locals.auditStore }
    );

    return json(
      {
        ok: true,
        replayed: receipt.data.replayed,
        receiptId: receipt.data.id,
        envelopeId: envelope.data.id,
        imported
      },
      { status: imported.created ? 202 : 200 }
    );
  } catch (error) {
    return json(
      { ok: false, error: error instanceof Error ? error.message : "Could not import WooCommerce order." },
      { status: 400 }
    );
  }
};
