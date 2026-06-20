import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { compose } from "@microservices-sh/connection-contract/composer";
import { deliverEvent } from "../src/use-cases/deliver-event";
import { listEndpoints } from "../src/use-cases/list-endpoints";
import { createMemoryWebhookEndpointStore } from "../src/adapters/memory-endpoint-store";
import { createMemoryDeliveryLog } from "../src/adapters/memory-delivery-log";
import { createMemoryHttpClient } from "../src/adapters/memory-http-client";

const manifest = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));

const deps = () => ({
  endpointStore: createMemoryWebhookEndpointStore(),
  deliveryLog: createMemoryDeliveryLog(),
  httpClient: createMemoryHttpClient()
});

describe("webhook-delivery connections manifest", () => {
  it("composes standalone with DANGLING_CONSUMER warnings (sources are optional)", () => {
    const r = compose([
      { id: "webhook-delivery", grantedScopes: [], connections: manifest.connections }
    ]);
    // Sink: it consumes core domain events whose source modules are marked
    // optional, so the build succeeds but warns about each dangling consumer.
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.wiring.modules).toContain("webhook-delivery");
      const dangling = r.warnings.filter((w) => w.code === "DANGLING_CONSUMER");
      expect(dangling.length).toBe(manifest.connections.events.consumes.length);
      for (const w of dangling) expect(w.severity).toBe("warn");
    }
  });

  it("declares typed hook points scoped to webhook-delivery.extend", () => {
    expect(manifest.connections.hookPoints.beforeWebhookDeliver.kind).toBe("filter");
    expect(manifest.connections.hookPoints.beforeWebhookDeliver.scope).toBe("webhook-delivery.extend");
    expect(manifest.connections.hookPoints.afterWebhookDelivered.kind).toBe("observer");
  });

  it("emits its delivery lifecycle events and marks all consumed sources optional", () => {
    expect(manifest.connections.events.emits).toContain("webhook.delivered");
    expect(manifest.connections.events.emits).toContain("webhook.failed");
    for (const ev of manifest.connections.events.consumes) {
      const source = ev.split(".")[0];
      expect(manifest.connections.optional).toContain(source);
    }
  });
});

describe("deliverEvent meta + namespaced errors", () => {
  it("threads correlationId through meta and the emitted outbound events", async () => {
    const d = deps();
    await d.endpointStore.insert({
      id: "whe_test",
      url: "https://example.test/hook",
      eventNames: [],
      secret: "s3cr3t",
      active: true,
      createdAt: new Date().toISOString()
    });

    const r = await deliverEvent(
      { eventName: "booking.created", entityType: "booking", entityId: "bk_1", payload: { id: "bk_1" } },
      { ...d, correlationId: "corr-x" }
    );

    expect(r.ok).toBe(true);
    expect(r.meta.correlationId).toBe("corr-x");
    expect(r.meta.source).toBe("webhook-delivery");
    if (r.ok) {
      expect(r.data.delivered).toBe(1);
      expect(r.data.events[0].correlationId).toBe("corr-x");
    }
  });

  it("validation errors are namespaced and carry meta", async () => {
    const r = await deliverEvent({}, deps());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("webhook-delivery.INVALID_EVENT_INPUT");
    expect(r.meta.source).toBe("webhook-delivery");
  });
});

describe("listEndpoints redaction", () => {
  it("lists registered endpoints without returning signing secrets", async () => {
    const d = deps();
    await d.endpointStore.insert({
      id: "whe_redacted",
      url: "https://example.test/hook",
      eventNames: ["customer.created"],
      secret: "never-return-this",
      active: true,
      createdAt: new Date().toISOString()
    });

    const r = await listEndpoints({ endpointStore: d.endpointStore, correlationId: "corr-endpoints" });
    expect(r.ok).toBe(true);
    expect(r.meta.correlationId).toBe("corr-endpoints");
    if (!r.ok) throw new Error("expected ok");
    expect(r.data.count).toBe(1);
    expect(r.data.endpoints[0]).toEqual(
      expect.objectContaining({ id: "whe_redacted", url: "https://example.test/hook", eventNames: ["customer.created"] })
    );
    expect(r.data.endpoints[0]).not.toHaveProperty("secret");
  });
});
