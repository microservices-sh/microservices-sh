import { describe, expect, it } from "vitest";
import { createOpsTokenVerifier } from "../src/index.js";
import { planOpsProvisioning } from "../src/provisioning.js";

const NOW = 1_750_000_000_000;
const grant = {
  ownerId: "ws_acme",
  scopes: ["ops.invoice.read", "ops.booking.read"],
  secret: "tenant-secret-acme",
  expiresAt: NOW + 30 * 24 * 60 * 60 * 1000
};

describe("planOpsProvisioning", () => {
  it("mints an OPS_TOKEN that the operate app's verifier (same secret) accepts", async () => {
    const plan = await planOpsProvisioning({ grant, hermesApp: "acme-hermes", operateApp: "acme-operate" });

    const verifier = createOpsTokenVerifier({ secret: grant.secret, now: () => NOW });
    const v = await verifier.verify(plan.opsToken);
    expect(v.ok).toBe(true);
    if (!v.ok) throw new Error("expected ok");
    expect(v.ownerId).toBe("ws_acme");
    expect(v.scopes).toEqual(["ops.invoice.read", "ops.booking.read"]);
  });

  it("emits the Hermes-machine command that sets OPS_TOKEN", async () => {
    const plan = await planOpsProvisioning({ grant, hermesApp: "acme-hermes", operateApp: "acme-operate" });
    expect(plan.hermesSecretCommand).toContain("fly secrets set");
    expect(plan.hermesSecretCommand).toContain("OPS_TOKEN=");
    expect(plan.hermesSecretCommand).toContain(plan.opsToken);
    expect(plan.hermesSecretCommand).toContain("-a acme-hermes");
  });

  it("emits the operate-app command that sets OPS_VERIFY_SECRET (the per-tenant secret)", async () => {
    const plan = await planOpsProvisioning({ grant, hermesApp: "acme-hermes", operateApp: "acme-operate" });
    expect(plan.operateSecretCommand).toContain("OPS_VERIFY_SECRET");
    expect(plan.operateSecretCommand).toContain("tenant-secret-acme");
    expect(plan.operateSecretCommand).toContain("acme-operate");
  });

  it("returns the token expiry so the caller can schedule rotation", async () => {
    const plan = await planOpsProvisioning({ grant, hermesApp: "a", operateApp: "b" });
    expect(plan.expiresAt).toBe(grant.expiresAt);
  });
});
