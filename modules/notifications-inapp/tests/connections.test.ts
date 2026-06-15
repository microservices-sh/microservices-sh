import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { compose } from "@microservices-sh/connection-contract/composer";
import { notify } from "../src/use-cases/notify";
import { createMemoryNotificationStore } from "../src/adapters/memory-notification-store";

const manifest = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));

const validInput = { userId: "A", type: "booking.confirmed", title: "Hi" };
const deps = () => ({ store: createMemoryNotificationStore() });

describe("notifications-inapp connections manifest", () => {
  it("composes standalone (no requires, no rpc.calls)", () => {
    const r = compose([
      { id: "notifications-inapp", grantedScopes: [], connections: manifest.connections },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.wiring.modules).toContain("notifications-inapp");
  });

  it("declares typed hook points", () => {
    expect(manifest.connections.hookPoints.beforeNotify.kind).toBe("filter");
    expect(manifest.connections.hookPoints.renderNotification.kind).toBe("filter");
  });

  it("emits its lifecycle events and consumes none", () => {
    expect(manifest.connections.events.emits).toContain("notification.created");
    expect(manifest.connections.events.consumes).toEqual([]);
  });
});

describe("notify meta + namespaced errors", () => {
  it("threads correlationId through meta and the emitted event", async () => {
    const r = await notify(validInput, { ...deps(), correlationId: "corr-x" });
    expect(r.ok).toBe(true);
    expect(r.meta.correlationId).toBe("corr-x");
    if (r.ok) expect(r.data.event?.correlationId).toBe("corr-x");
  });

  it("validation errors are namespaced and carry meta", async () => {
    const r = await notify({}, deps());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("notifications-inapp.INVALID_NOTIFICATION_INPUT");
    expect(r.meta.source).toBe("notifications-inapp");
  });
});
