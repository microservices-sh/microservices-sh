import { describe, it, expect } from "vitest";
import { buildHoneycomb, formatHoneycomb } from "../src/graph.js";

// Uses the real modules/<id>/module.json connections blocks for a small,
// known set. auth exposes verifyToken; payment calls it and emits
// payment.succeeded; booking consumes payment.succeeded and registers no hook
// here but exposes its own hook points. This asserts the resolved honeycomb the
// `graph --json` command prints.
describe("graph command core (buildHoneycomb)", () => {
  it("resolves rpc, event, and hook wiring for an explicit module set", async () => {
    const { ids, result } = await buildHoneycomb({ modules: "auth,customer,payment,booking" });

    expect(ids).toEqual(["auth", "customer", "payment", "booking"]);
    expect(result.ok).toBe(true);

    // RPC edge: payment calls auth.verifyToken (resolved via auth's exposes).
    expect(result.wiring.rpc).toContainEqual(
      expect.objectContaining({ from: "payment", target: "auth.verifyToken" })
    );
    // RPC edge: booking calls customer.getCustomer.
    expect(result.wiring.rpc).toContainEqual(
      expect.objectContaining({ from: "booking", target: "customer.getCustomer" })
    );

    // Event edge: payment.succeeded flows from payment to booking (consumer).
    expect(result.wiring.events).toContainEqual(
      expect.objectContaining({ event: "payment.succeeded", from: "payment", to: "booking" })
    );

    // Modules are sorted in the stable wiring.
    expect(result.wiring.modules).toEqual([...result.wiring.modules].sort());
  });

  it("produces a readable summary that lists modules and edges", async () => {
    const { result } = await buildHoneycomb({ modules: "auth,customer,payment,booking" });
    const text = formatHoneycomb(result.wiring, result.warnings);
    expect(text).toContain("Modules");
    expect(text).toContain("RPC:");
    expect(text).toContain("payment -> auth.verifyToken");
    expect(text).toContain("payment.succeeded: payment -> [booking]");
  });

  it("resolves the default template module set", async () => {
    const { ids, result } = await buildHoneycomb({});
    expect(ids).toContain("auth");
    expect(result.ok).toBe(true);
  });
});
