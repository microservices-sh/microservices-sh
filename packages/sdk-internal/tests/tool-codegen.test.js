import { describe, it, expect } from "vitest";
import {
  isReadMethod,
  toolName,
  toolDescriptor,
  generateToolManifest,
  generateToolManifestFile,
} from "../src/tool-codegen.js";

// Real contract shapes (from modules/*/module.json).
const auth = {
  id: "auth",
  connections: {
    rpc: {
      exposes: [
        { method: "mintToken", scope: "auth.mint", public: false },
        { method: "verifyToken", scope: "auth.verify", public: false },
        { method: "getJwks", scope: null, public: true },
      ],
    },
  },
};
const customer = {
  id: "customer",
  rpc: [
    { method: "getCustomer", scope: "customer.read", public: false },
    { method: "listCustomers", scope: "customer.read", public: false },
    { method: "upsertCustomer", scope: "customer.write", public: false },
  ],
};
const identity = {
  id: "identity",
  rpc: [
    { method: "requestLoginCode", scope: "identity.login", public: false },
    { method: "verifyLoginCode", scope: "identity.login", public: false },
    { method: "readSession", scope: "identity.session", public: false },
    { method: "destroySession", scope: "identity.session", public: false },
  ],
};
const rbac = { id: "org-team-rbac", rpc: [{ method: "authorize", scope: "org.read", public: false }] };
const codeMemory = {
  id: "code-memory",
  rpc: [
    { method: "addTrustedSource", scope: "code-memory.write", public: false },
    { method: "listTrustedSources", scope: "code-memory.read", public: false },
    { method: "recordSourceScan", scope: "code-memory.write", public: false },
    { method: "createLogicCapsule", scope: "code-memory.write", public: false },
    { method: "searchLogicCapsules", scope: "code-memory.read", public: false },
    { method: "getLogicCapsule", scope: "code-memory.read", public: false },
    { method: "approveLogicCapsule", scope: "code-memory.approve", public: false },
    { method: "rejectLogicCapsule", scope: "code-memory.approve", public: false },
  ],
};

describe("isReadMethod", () => {
  it("read by name prefix", () => {
    expect(isReadMethod({ method: "getCustomer", scope: "customer.read" })).toBe(true);
    expect(isReadMethod({ method: "listCustomers", scope: "customer.read" })).toBe(true);
  });
  it("read by scope suffix even when the name is not a read prefix", () => {
    expect(isReadMethod({ method: "authorize", scope: "org.read" })).toBe(true);
    expect(isReadMethod({ method: "verifyToken", scope: "auth.verify" })).toBe(true);
  });
  it("mutation by default when neither signal says read", () => {
    expect(isReadMethod({ method: "mintToken", scope: "auth.mint" })).toBe(false);
    expect(isReadMethod({ method: "verifyLoginCode", scope: "identity.login" })).toBe(false);
    expect(isReadMethod({ method: "upsertCustomer", scope: "customer.write" })).toBe(false);
  });
  it("an explicit mutation flag overrides the heuristic", () => {
    expect(isReadMethod({ method: "mintToken", scope: "auth.mint", mutation: false })).toBe(true);
    expect(isReadMethod({ method: "getThing", scope: "x.read", mutation: true })).toBe(false);
  });
});

describe("toolDescriptor", () => {
  it("public read (getJwks): no scope, public, not confirmation-gated", () => {
    const d = toolDescriptor("auth", { method: "getJwks", scope: null, public: true });
    expect(d).toMatchObject({
      name: "auth_getJwks",
      module: "auth",
      method: "getJwks",
      scope: null,
      public: true,
      mutation: false,
      requiresConfirmation: false,
    });
    expect(d.description).toContain("read-only");
    expect(d.description).toContain("public");
  });
  it("scoped mutation (mintToken): confirm-gated and carries its scope", () => {
    const d = toolDescriptor("auth", { method: "mintToken", scope: "auth.mint", public: false });
    expect(d).toMatchObject({
      name: "auth_mintToken",
      scope: "auth.mint",
      public: false,
      mutation: true,
      requiresConfirmation: true,
    });
    expect(d.description).toContain("approval-gated");
    expect(d.description).toContain("requires scope auth.mint");
  });
});

describe("toolName", () => {
  it("keeps hyphenated module ids (MCP-name-safe chars)", () => {
    expect(toolName("org-team-rbac", "authorize")).toBe("org-team-rbac_authorize");
  });
});

describe("generateToolManifest", () => {
  it("emits one descriptor per rpc method with the right mutation flags", () => {
    const tools = generateToolManifest(customer);
    expect(tools.map((t) => t.name)).toEqual([
      "customer_getCustomer",
      "customer_listCustomers",
      "customer_upsertCustomer",
    ]);
    expect(tools.map((t) => t.mutation)).toEqual([false, false, true]);
  });
  it("classifies identity correctly (request/verify mutate, read does not, destroy mutates)", () => {
    const byMethod = Object.fromEntries(generateToolManifest(identity).map((t) => [t.method, t.mutation]));
    expect(byMethod).toEqual({
      requestLoginCode: true,
      verifyLoginCode: true,
      readSession: false,
      destroySession: true,
    });
  });
  it("classifies Code Memory reads, writes, and approval-gated tools", () => {
    const tools = generateToolManifest(codeMemory);
    expect(tools).toHaveLength(8);
    expect(tools.map((tool) => tool.name)).toEqual([
      "code-memory_addTrustedSource",
      "code-memory_listTrustedSources",
      "code-memory_recordSourceScan",
      "code-memory_createLogicCapsule",
      "code-memory_searchLogicCapsules",
      "code-memory_getLogicCapsule",
      "code-memory_approveLogicCapsule",
      "code-memory_rejectLogicCapsule",
    ]);

    const byMethod = Object.fromEntries(tools.map((tool) => [tool.method, tool]));
    expect(byMethod.listTrustedSources).toMatchObject({ mutation: false, requiresConfirmation: false, scope: "code-memory.read" });
    expect(byMethod.searchLogicCapsules).toMatchObject({ mutation: false, requiresConfirmation: false, scope: "code-memory.read" });
    expect(byMethod.getLogicCapsule).toMatchObject({ mutation: false, requiresConfirmation: false, scope: "code-memory.read" });
    expect(byMethod.addTrustedSource).toMatchObject({ mutation: true, requiresConfirmation: true, scope: "code-memory.write" });
    expect(byMethod.recordSourceScan).toMatchObject({ mutation: true, requiresConfirmation: true, scope: "code-memory.write" });
    expect(byMethod.createLogicCapsule).toMatchObject({ mutation: true, requiresConfirmation: true, scope: "code-memory.write" });
    expect(byMethod.approveLogicCapsule).toMatchObject({ mutation: true, requiresConfirmation: true, scope: "code-memory.approve" });
    expect(byMethod.rejectLogicCapsule).toMatchObject({ mutation: true, requiresConfirmation: true, scope: "code-memory.approve" });
  });
  it("works for both connections.rpc.exposes and legacy flat rpc", () => {
    expect(generateToolManifest(auth).length).toBe(3); // nested connections
    expect(generateToolManifest(customer).length).toBe(3); // flat rpc
  });
  it("returns [] for a module with no rpc contract", () => {
    expect(generateToolManifest({ id: "email" })).toEqual([]);
    expect(generateToolManifest(null)).toEqual([]);
  });
});

describe("generateToolManifestFile", () => {
  it("emits a deterministic, name-sorted TS manifest across modules", () => {
    const a = generateToolManifestFile([auth, customer, rbac]);
    const b = generateToolManifestFile([rbac, customer, auth]); // different input order
    expect(a).toBe(b); // deterministic regardless of input order

    expect(a).toContain("export const toolManifest =");
    expect(a).toContain('"name": "auth_getJwks"');
    expect(a).toContain('"name": "org-team-rbac_authorize"');

    // name-sorted: auth_* < customer_* < org-team-rbac_*
    expect(a.indexOf("auth_getJwks")).toBeLessThan(a.indexOf("customer_getCustomer"));
    expect(a.indexOf("customer_upsertCustomer")).toBeLessThan(a.indexOf("org-team-rbac_authorize"));
  });
});
