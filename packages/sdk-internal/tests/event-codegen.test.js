import { describe, it, expect } from "vitest";
import { eventRoutes, generateEventRouter } from "../src/event-codegen.js";

const wiring = {
  events: [
    { event: "payment.succeeded", from: "payment", to: "booking" },
    { event: "payment.succeeded", from: "payment", to: "audit-log" },
    { event: "booking.created", from: "booking", to: "audit-log" },
  ],
};

describe("eventRoutes", () => {
  it("maps each event to its consumer modules (deduped, stable order)", () => {
    expect(eventRoutes(wiring)).toEqual({
      "payment.succeeded": ["audit-log", "booking"],
      "booking.created": ["audit-log"],
    });
  });
  it("empty wiring → empty table", () => {
    expect(eventRoutes({ events: [] })).toEqual({});
  });
});

describe("generateEventRouter", () => {
  it("emits an importable routes table with consumers", () => {
    const code = generateEventRouter(wiring);
    expect(code).toContain("export const eventRoutes");
    expect(code).toContain("payment.succeeded");
    expect(code).toContain("booking");
    expect(code).toContain("audit-log");
  });
});
