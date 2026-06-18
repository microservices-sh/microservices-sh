import { describe, expect, it } from "vitest";
import { consumeEvent, createMemoryAuditEventStore, listEvents, signEnvelope } from "./index";
import type { EventEnvelope } from "./types";

const baseEnvelope: EventEnvelope = {
  eventName: "thing.created",
  actorId: "usr_1",
  entityType: "thing",
  entityId: "thing_1",
  source: "test",
  payload: { ok: true }
};

describe("audit-log: consumeEvent signed-envelope mode", () => {
  it("keeps unsigned envelopes accepted by default for local/dev compatibility", async () => {
    const auditStore = createMemoryAuditEventStore();

    const consumed = await consumeEvent(baseEnvelope, { auditStore });
    expect(consumed.ok).toBe(true);

    const listed = await listEvents({ eventName: "thing.created" }, { auditStore });
    expect(listed.ok).toBe(true);
    if (listed.ok) expect(listed.data.events).toHaveLength(1);
  });

  it("fails closed when signed envelopes are required and no secret is configured", async () => {
    const auditStore = createMemoryAuditEventStore();

    const consumed = await consumeEvent(baseEnvelope, { auditStore, requireSignedEnvelope: true });
    expect(consumed).toMatchObject({
      ok: false,
      status: 401,
      error: { code: "MISSING_ENVELOPE_SECRET" }
    });

    const listed = await listEvents({}, { auditStore });
    expect(listed.ok).toBe(true);
    if (listed.ok) expect(listed.data.events).toHaveLength(0);
  });

  it("accepts valid signed envelopes and rejects tampered ones in strict mode", async () => {
    const auditStore = createMemoryAuditEventStore();
    const signed = await signEnvelope(baseEnvelope, "tenant-secret");

    const consumed = await consumeEvent(signed, {
      auditStore,
      secret: "tenant-secret",
      config: { requireSignedEnvelope: true }
    });
    expect(consumed.ok).toBe(true);

    const tampered = await consumeEvent(
      { ...signed, entityId: "thing_evil" },
      { auditStore, secret: "tenant-secret", requireSignedEnvelope: true }
    );
    expect(tampered).toMatchObject({
      ok: false,
      status: 401,
      error: { code: "INVALID_ENVELOPE" }
    });
  });
});
