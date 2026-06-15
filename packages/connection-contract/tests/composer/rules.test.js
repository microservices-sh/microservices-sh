import { describe, it, expect } from "vitest";
import { buildGraph } from "../../src/composer/graph.js";
import { allRules, runRules } from "../../src/composer/rules.js";
import { mod, validSet } from "./fixtures.js";

function issuesFor(modules) {
  const g = buildGraph(modules);
  return runRules(g, modules);
}
const codes = (issues) => issues.map((i) => i.code);

describe("composer rules", () => {
  it("valid set produces no error-severity issues", () => {
    const issues = issuesFor(validSet()).filter((i) => i.severity === "error");
    expect(issues).toEqual([]);
  });

  it("exposes all 7 rules", () => {
    expect(allRules).toHaveLength(7);
  });

  // 9.1
  it("MISSING_MODULE: requires/rpc.calls target an absent module", () => {
    const modules = [
      mod("payment", ["auth.verify"], { requires: ["auth"], rpc: { calls: [{ target: "auth.verifyToken", scope: "auth.verify" }] } }),
    ];
    expect(codes(issuesFor(modules))).toContain("MISSING_MODULE");
  });

  // 9.2
  it("DANGLING_CONSUMER: consumes an event with no emitter (error when not optional)", () => {
    const modules = [mod("booking", [], { events: { consumes: ["payment.succeeded"] } })];
    const issues = issuesFor(modules);
    expect(codes(issues)).toContain("DANGLING_CONSUMER");
    expect(issues.find((i) => i.code === "DANGLING_CONSUMER").severity).toBe("error");
  });

  it("DANGLING_CONSUMER: warn when the emitter module is in optional", () => {
    const modules = [mod("booking", [], { optional: ["payment"], events: { consumes: ["payment.succeeded"] } })];
    const issue = issuesFor(modules).find((i) => i.code === "DANGLING_CONSUMER");
    expect(issue.severity).toBe("warn");
  });

  // 9.3
  it("SCOPE_GAP: caller lacks the scope its rpc.call requires", () => {
    const modules = [
      mod("auth", [], { rpc: { exposes: [{ method: "verifyToken", scope: "auth.verify", public: false }] } }),
      mod("payment", [], { requires: ["auth"], rpc: { calls: [{ target: "auth.verifyToken", scope: "auth.verify" }] } }),
    ];
    expect(codes(issuesFor(modules))).toContain("SCOPE_GAP");
  });

  it("SCOPE_GAP: hook registrant lacks the hook point scope", () => {
    const modules = [
      mod("auth", [], { hookPoints: { beforeMint: { kind: "filter", scope: "auth.extend" } } }),
      mod("payment", [], { provides: { hooks: [{ target: "auth.beforeMint", handler: "h.ts", order: 10 }] } }),
    ];
    expect(codes(issuesFor(modules))).toContain("SCOPE_GAP");
  });

  // 9.4
  it("HOOK_TARGET_MISSING: provides.hooks targets a non-existent hook point", () => {
    const modules = [
      mod("auth", [], {}),
      mod("payment", ["auth.extend"], { provides: { hooks: [{ target: "auth.nope", handler: "h.ts", order: 10 }] } }),
    ];
    expect(codes(issuesFor(modules))).toContain("HOOK_TARGET_MISSING");
  });

  // 9.5
  it("HOOK_ORDER_COLLISION: two handlers share a hook point + order", () => {
    const modules = [
      mod("auth", [], { hookPoints: { beforeMint: { kind: "filter", scope: null } } }),
      mod("a", [], { provides: { hooks: [{ target: "auth.beforeMint", handler: "a.ts", order: 10 }] } }),
      mod("b", [], { provides: { hooks: [{ target: "auth.beforeMint", handler: "b.ts", order: 10 }] } }),
    ];
    expect(codes(issuesFor(modules))).toContain("HOOK_ORDER_COLLISION");
  });

  // 9.6
  it("SCHEMA_MISMATCH: declared call input != exposed input", () => {
    const modules = [
      mod("auth", [], { rpc: { exposes: [{ method: "verifyToken", scope: null, public: true, input: "auth/verify.json" }] } }),
      mod("payment", [], { rpc: { calls: [{ target: "auth.verifyToken", input: "wrong/shape.json" }] } }),
    ];
    expect(codes(issuesFor(modules))).toContain("SCHEMA_MISMATCH");
  });

  // 9.7
  it("DEPENDENCY_CYCLE: requires graph has a cycle", () => {
    const modules = [
      mod("a", [], { requires: ["b"] }),
      mod("b", [], { requires: ["a"] }),
    ];
    expect(codes(issuesFor(modules))).toContain("DEPENDENCY_CYCLE");
  });
});
