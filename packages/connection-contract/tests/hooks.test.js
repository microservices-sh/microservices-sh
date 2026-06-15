import { describe, it, expect, vi } from "vitest";
import { runHooks } from "../src/hooks.js";

const ctx = { correlationId: "c1" };

describe("runHooks", () => {
  it("filters fold input in order", async () => {
    const chain = [
      { kind: "filter", order: 20, fn: async (i) => ({ ...i, b: i.a + 1 }) },
      { kind: "filter", order: 10, fn: async (i) => ({ ...i, a: 1 }) },
    ];
    const r = await runHooks("p", { a: 0 }, ctx, chain);
    expect(r).toEqual({ ok: true, value: { a: 1, b: 2 } });
  });

  it("guard veto aborts and surfaces its error", async () => {
    const chain = [
      { kind: "guard", order: 10, fn: async () => ({ ok: false, status: 409, error: { code: "x.NO", message: "no" } }) },
      { kind: "filter", order: 20, fn: async () => { throw new Error("should not run"); } },
    ];
    const r = await runHooks("p", {}, ctx, chain);
    expect(r.ok).toBe(false);
    expect(r.status).toBe(409);
    expect(r.error.code).toBe("x.NO");
  });

  it("guard that passes does not mutate input", async () => {
    const chain = [{ kind: "guard", order: 10, fn: async () => ({ ok: true }) }];
    const r = await runHooks("p", { v: 1 }, ctx, chain);
    expect(r).toEqual({ ok: true, value: { v: 1 } });
  });

  it("filter throw aborts with HOOK_FAILED", async () => {
    const chain = [{ kind: "filter", order: 10, fn: async () => { throw new Error("boom"); } }];
    const r = await runHooks("p", {}, ctx, chain);
    expect(r.ok).toBe(false);
    expect(r.error.code).toBe("HOOK_FAILED");
    expect(r.error.cause).toContain("boom");
  });

  it("observer throw is swallowed; op continues unchanged", async () => {
    const spy = vi.fn(async () => { throw new Error("ignored"); });
    const chain = [{ kind: "observer", order: 10, fn: spy }];
    const r = await runHooks("p", { v: 1 }, ctx, chain);
    expect(spy).toHaveBeenCalled();
    expect(r).toEqual({ ok: true, value: { v: 1 } });
  });

  it("empty chain returns input unchanged", async () => {
    const r = await runHooks("p", { v: 1 }, ctx, []);
    expect(r).toEqual({ ok: true, value: { v: 1 } });
  });
});
