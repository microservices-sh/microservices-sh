// Cross-tenant LEAK TEST (plans/33, L4). Seed two tenants, act as tenant A, and
// assert no tenant-B data ever crosses the boundary — through list, get, update,
// and delete — and that a forged/foreign id is rejected as not-found. This is the
// executable proof for the ScopedStore reference; real adapters reuse the shape.

import { describe, it, expect, beforeEach } from "vitest";
import {
  authContext,
  enforceScope,
  scopedFilter,
  ScopeViolationError,
  InMemoryScopedStore,
} from "../src/index.js";

const ORG_A = "org_aaa";
const ORG_B = "org_bbb";

const ctxA = authContext({ orgId: ORG_A, actorId: "user_a", roles: ["member"] });
const ctxB = authContext({ orgId: ORG_B, actorId: "user_b", roles: ["member"] });

let store;
beforeEach(() => {
  store = new InMemoryScopedStore({
    rows: [
      { id: "a1", org_id: ORG_A, secret: "A-one" },
      { id: "a2", org_id: ORG_A, secret: "A-two" },
      { id: "b1", org_id: ORG_B, secret: "B-one" },
      { id: "b2", org_id: ORG_B, secret: "B-two" },
    ],
  });
});

describe("authContext", () => {
  it("requires a non-empty orgId and actorId", () => {
    expect(() => authContext({ orgId: "", actorId: "u" })).toThrow();
    expect(() => authContext({ orgId: "o", actorId: "" })).toThrow();
  });
  it("defaults roles to an empty array", () => {
    expect(authContext({ orgId: "o", actorId: "u" }).roles).toEqual([]);
  });
});

describe("scopedFilter", () => {
  it("returns a storage-agnostic { column, equals } descriptor", () => {
    expect(scopedFilter(ctxA)).toEqual({ column: "org_id", equals: ORG_A });
  });
});

describe("enforceScope", () => {
  it("passes for an in-org row and throws ScopeViolationError for a foreign one", () => {
    expect(enforceScope(ctxA, ORG_A)).toBe(true);
    expect(() => enforceScope(ctxA, ORG_B)).toThrow(ScopeViolationError);
    expect(enforceScope(ctxA, ORG_B, { assert: false })).toBe(false);
  });
});

describe("cross-tenant leak test", () => {
  it("list as A returns ONLY A rows — zero B rows", () => {
    const rows = store.list(ctxA);
    expect(rows.map((r) => r.id).sort()).toEqual(["a1", "a2"]);
    expect(rows.some((r) => r.org_id === ORG_B)).toBe(false);
  });

  it("get rejects a forged/foreign id (B row) as not-found for A", () => {
    expect(store.get(ctxA, "b1")).toBeNull();
    expect(store.get(ctxA, "b2")).toBeNull();
    // A can still read its own.
    expect(store.get(ctxA, "a1")).toMatchObject({ id: "a1", org_id: ORG_A });
  });

  it("update of a foreign id is a no-op and leaks nothing", () => {
    expect(store.update(ctxA, "b1", { secret: "pwned" })).toBeNull();
    // B's data is untouched when B reads it.
    expect(store.get(ctxB, "b1")).toMatchObject({ secret: "B-one" });
  });

  it("delete of a foreign id is a no-op and B's rows survive", () => {
    expect(store.delete(ctxA, "b1")).toBe(false);
    expect(store.list(ctxB).map((r) => r.id).sort()).toEqual(["b1", "b2"]);
  });

  it("create stamps the active org, never an injected one", () => {
    const created = store.create(ctxA, { id: "a3", org_id: ORG_B, secret: "x" });
    expect(created.org_id).toBe(ORG_A);
    expect(store.get(ctxB, "a3")).toBeNull();
    expect(store.get(ctxA, "a3")).toMatchObject({ id: "a3", org_id: ORG_A });
  });

  it("an update patch attempting to move a row into a foreign org is rejected", () => {
    expect(() => store.update(ctxA, "a1", { org_id: ORG_B })).toThrow(
      ScopeViolationError,
    );
  });

  it("symmetry: B never sees A rows either", () => {
    expect(store.list(ctxB).every((r) => r.org_id === ORG_B)).toBe(true);
    expect(store.get(ctxB, "a1")).toBeNull();
  });
});
