import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { compose } from "@microservices-sh/connection-contract/composer";
import { connectCalendar } from "../src/use-cases/connect-calendar";
import { createMemoryTokenStore, createMemorySyncStateStore } from "../src/adapters/memory-stores";

const manifest = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));

const validInput = {
  tenantId: "tenant-1",
  calendarId: "primary",
  refreshToken: "refresh-1",
  accessTokenExpiresAt: Date.parse("2026-01-01T00:00:00.000Z")
};
const deps = () => ({ tokenStore: createMemoryTokenStore(), syncStateStore: createMemorySyncStateStore() });

describe("calendar-google connections manifest", () => {
  it("composes standalone (no requires, no rpc.calls)", () => {
    const r = compose([
      { id: "calendar-google", grantedScopes: [], connections: manifest.connections }
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.wiring.modules).toContain("calendar-google");
  });

  it("declares typed hook points", () => {
    expect(manifest.connections.hookPoints.beforeCalendarSync.kind).toBe("guard");
    expect(manifest.connections.hookPoints.onCalendarEventUpserted.kind).toBe("observer");
    expect(manifest.connections.hookPoints.onChannelRenewed.kind).toBe("observer");
  });

  it("emits its lifecycle events and consumes no module events (push is an external webhook)", () => {
    expect(manifest.connections.events.emits).toContain("calendar-google.connected");
    expect(manifest.connections.events.emits).toContain("calendar-google.synced");
    expect(manifest.connections.events.consumes).toEqual([]);
  });

  it("exposes no rpc (self-contained vertical)", () => {
    expect(manifest.connections.rpc.exposes).toEqual([]);
    expect(manifest.connections.rpc.calls).toEqual([]);
  });
});

describe("connectCalendar meta + namespaced errors", () => {
  it("threads correlationId through meta and the emitted event", async () => {
    const r = await connectCalendar(validInput, { ...deps(), correlationId: "corr-x" });
    expect(r.ok).toBe(true);
    expect(r.meta.correlationId).toBe("corr-x");
    if (r.ok) expect(r.data.event?.correlationId).toBe("corr-x");
  });

  it("validation errors are namespaced and carry meta", async () => {
    const r = await connectCalendar({}, deps());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("calendar-google.INVALID_CONNECT_INPUT");
    expect(r.meta.source).toBe("calendar-google");
  });
});
