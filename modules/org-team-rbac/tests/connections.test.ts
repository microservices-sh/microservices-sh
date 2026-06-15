import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { compose } from "@microservices-sh/connection-contract/composer";
import { createOrganization } from "../src/use-cases/create-organization";
import { acceptInvitation } from "../src/use-cases/accept-invitation";
import { authorize } from "../src/use-cases/authorize";
import { createMemoryRbacStore } from "../src/adapters/memory-rbac-store";

const manifest = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));

describe("org-team-rbac connections manifest", () => {
  it("composes standalone (requires empty; auth/audit-log are optional)", () => {
    const r = compose([
      { id: "org-team-rbac", grantedScopes: [], connections: manifest.connections },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.wiring.modules).toContain("org-team-rbac");
  });

  it("composes alongside its optional deps without errors", () => {
    const r = compose([
      { id: "org-team-rbac", grantedScopes: [], connections: manifest.connections },
      {
        id: "auth",
        grantedScopes: [],
        connections: { requires: [], optional: [], rpc: { exposes: [], calls: [] }, events: { emits: [], consumes: [] }, hookPoints: {}, provides: { hooks: [] } },
      },
      {
        id: "audit-log",
        grantedScopes: [],
        connections: { requires: [], optional: [], rpc: { exposes: [], calls: [] }, events: { emits: [], consumes: [] }, hookPoints: {}, provides: { hooks: [] } },
      },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.wiring.modules).toEqual(["audit-log", "auth", "org-team-rbac"]);
  });

  it("exposes the authorize gate as an rpc method", () => {
    const exposes = manifest.connections.rpc.exposes;
    expect(exposes.map((e: { method: string }) => e.method)).toContain("authorize");
    expect(manifest.connections.rpc.calls).toEqual([]);
  });

  it("declares typed hook points with extend/observe scopes", () => {
    expect(manifest.connections.hookPoints.beforeInvite.kind).toBe("filter");
    expect(manifest.connections.hookPoints.beforeInvite.scope).toBe("org-team-rbac.extend");
    expect(manifest.connections.hookPoints.onMembershipChanged.kind).toBe("observer");
    expect(manifest.connections.hookPoints.onMembershipChanged.scope).toBe("org-team-rbac.observe");
  });

  it("emits its lifecycle events and consumes none", () => {
    expect(manifest.connections.events.emits).toContain("org.created");
    expect(manifest.connections.events.emits).toContain("member.joined");
    expect(manifest.connections.events.consumes).toEqual([]);
  });
});

describe("org-team-rbac meta + namespaced errors", () => {
  const fixedNow = () => Date.parse("2026-01-01T00:00:00.000Z");

  it("threads correlationId through meta and the emitted event", async () => {
    const store = createMemoryRbacStore();
    const r = await createOrganization(
      { name: "Acme", slug: "acme", ownerUserId: "owner-1" },
      { store, now: fixedNow, correlationId: "corr-x" }
    );
    expect(r.ok).toBe(true);
    expect(r.meta.correlationId).toBe("corr-x");
    if (r.ok) expect(r.data.event?.correlationId).toBe("corr-x");
  });

  it("validation errors are namespaced and carry meta", async () => {
    const store = createMemoryRbacStore();
    const r = await acceptInvitation({}, { store, correlationId: "corr-y" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("org-team-rbac.INVALID_ACCEPT_INPUT");
    expect(r.meta.source).toBe("org-team-rbac");
    expect(r.meta.correlationId).toBe("corr-y");
  });

  it("authorize denies a non-member with a namespaced FORBIDDEN code", async () => {
    const store = createMemoryRbacStore();
    const org = await createOrganization(
      { name: "Beta", slug: "beta", ownerUserId: "owner-1" },
      { store, now: fixedNow }
    );
    if (!org.ok) throw new Error("seed failed");
    const r = await authorize(org.data.id, "stranger", "org.read", { store, correlationId: "corr-z" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("org-team-rbac.FORBIDDEN");
    expect(r.meta.correlationId).toBe("corr-z");
  });
});
