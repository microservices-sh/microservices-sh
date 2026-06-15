import { describe, it, expect } from "vitest";
import { handleQueueBatch } from "../../src/runtime/event-consumer.js";
import { signEnvelope } from "../../src/event-envelope.js";

const routes = { "payment.succeeded": ["booking", "audit-log"] };
const base = {
  eventName: "payment.succeeded",
  entityType: "payment",
  entityId: "p1",
  source: "payment",
  correlationId: "c1",
  payload: { a: 1 },
};

describe("handleQueueBatch", () => {
  it("verifies envelopes and fans out to each consumer", async () => {
    const signed = await signEnvelope(base, "secret");
    const calls = [];
    const r = await handleQueueBatch([{ body: signed }], {
      routes,
      secret: "secret",
      dispatch: async (m, e) => calls.push([m, e.eventName, e.correlationId]),
    });
    expect(r).toEqual({ acked: 1, rejected: 0 });
    expect(calls).toEqual([
      ["booking", "payment.succeeded", "c1"],
      ["audit-log", "payment.succeeded", "c1"],
    ]);
  });

  it("rejects a tampered envelope (no dispatch)", async () => {
    const signed = await signEnvelope(base, "secret");
    const tampered = { ...signed, correlationId: "evil" };
    let dispatched = false;
    const r = await handleQueueBatch([{ body: tampered }], {
      routes,
      secret: "secret",
      dispatch: async () => { dispatched = true; },
    });
    expect(r).toEqual({ acked: 0, rejected: 1 });
    expect(dispatched).toBe(false);
  });

  it("acks an event with no consumers without dispatching", async () => {
    const signed = await signEnvelope({ ...base, eventName: "payment.refunded" }, "secret");
    let dispatched = false;
    const r = await handleQueueBatch([{ body: signed }], {
      routes,
      secret: "secret",
      dispatch: async () => { dispatched = true; },
    });
    expect(r).toEqual({ acked: 1, rejected: 0 });
    expect(dispatched).toBe(false);
  });

  it("calls msg.ack()/msg.retry() when present", async () => {
    const signed = await signEnvelope(base, "secret");
    let acked = false;
    await handleQueueBatch([{ body: signed, ack: () => { acked = true; }, retry: () => {} }], {
      routes,
      secret: "secret",
      dispatch: async () => {},
    });
    expect(acked).toBe(true);
  });
});
