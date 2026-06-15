import { describe, it, expect } from "vitest";
import { signEnvelope, verifyEnvelope } from "../src/event-envelope.js";

const base = {
  eventName: "payment.succeeded",
  entityType: "payment",
  entityId: "p1",
  source: "payment",
  actorId: null,
  correlationId: "c1",
  payload: { amount: 100 },
};

describe("event-envelope", () => {
  it("signs and verifies", async () => {
    const signed = await signEnvelope(base, "secret");
    expect(signed.signature).toBeTypeOf("string");
    expect(signed.signature.length).toBeGreaterThan(0);
    expect(await verifyEnvelope(signed, "secret")).toBe(true);
  });

  it("fails verification if correlationId is tampered (it is signed)", async () => {
    const signed = await signEnvelope(base, "secret");
    const tampered = { ...signed, correlationId: "c2" };
    expect(await verifyEnvelope(tampered, "secret")).toBe(false);
  });

  it("fails verification if payload is tampered", async () => {
    const signed = await signEnvelope(base, "secret");
    const tampered = { ...signed, payload: { amount: 999 } };
    expect(await verifyEnvelope(tampered, "secret")).toBe(false);
  });

  it("fails on wrong secret", async () => {
    const signed = await signEnvelope(base, "secret");
    expect(await verifyEnvelope(signed, "other")).toBe(false);
  });

  it("fails when no signature present", async () => {
    expect(await verifyEnvelope(base, "secret")).toBe(false);
  });
});
