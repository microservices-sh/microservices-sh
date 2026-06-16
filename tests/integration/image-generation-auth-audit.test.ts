import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { compose } from "@microservices-sh/connection-contract/composer";
import {
  mintToken,
  verifyToken,
  rotateSigningKey,
  requireScope,
  createMemorySigningKeyStore,
} from "@microservices-sh/auth";
import { recordEvent, listEvents } from "@microservices-sh/audit-log";
import { createMemoryAuditEventStore } from "@microservices-sh/audit-log/adapters/memory";
import {
  generateImage,
  deleteImage,
  createMemoryImageStore,
  createMemoryObjectStorage,
  createMemoryImageProvider,
} from "@microservices-sh/image-generation";

const authManifest = JSON.parse(readFileSync(new URL("../../modules/auth/module.json", import.meta.url), "utf8"));
const auditManifest = JSON.parse(readFileSync(new URL("../../modules/audit-log/module.json", import.meta.url), "utf8"));
const imageManifest = JSON.parse(readFileSync(new URL("../../modules/image-generation/module.json", import.meta.url), "utf8"));

const CID = "corr-img-int-1";

async function authStore() {
  const store = createMemorySigningKeyStore();
  await rotateSigningKey({ signingKeyStore: store });
  return store;
}

function imageDeps() {
  return {
    providers: { "kie-ai": createMemoryImageProvider({ id: "kie-ai" }) },
    store: createMemoryImageStore(),
    storage: createMemoryObjectStorage(),
  };
}

describe("compose [auth, audit-log, image-generation] (embedded)", () => {
  it("resolves the honeycomb with no errors", () => {
    const r = compose([
      { id: "auth", grantedScopes: [], connections: authManifest.connections },
      { id: "audit-log", grantedScopes: [], connections: auditManifest.connections },
      { id: "image-generation", grantedScopes: ["auth.verify"], connections: imageManifest.connections },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.wiring.modules).toContain("image-generation");
  });
});

describe("host flow: auth-gated generate → audited", () => {
  it("a caller with image.generate generates, and the event is recorded to audit-log", async () => {
    const keys = await authStore();
    const auditStore = createMemoryAuditEventStore();
    const deps = imageDeps();

    // 1. Auth: mint + verify a token carrying the scope the operation needs.
    const minted = await mintToken(
      { subject: "user-1", workspace: "w1", project: "p1", scopes: ["image.generate"] },
      { signingKeyStore: keys, correlationId: CID },
    );
    expect(minted.ok).toBe(true);
    if (!minted.ok) return;
    const verified = await verifyToken({ token: minted.data.token }, { signingKeyStore: keys, correlationId: CID });
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;

    // 2. Host gate: the callee checks the scope against its own permission.
    expect(requireScope(verified.data.claims, "image.generate").ok).toBe(true);

    // 3. Generate (stub provider), threading the same correlationId.
    const gen = await generateImage(
      { tenantId: verified.data.claims.sub, prompt: "a red fox", aspectRatio: "16:9" },
      { ...deps, correlationId: CID },
    );
    expect(gen.ok).toBe(true);
    if (!gen.ok) return;
    const event = (gen.data as { event?: { name: string; correlationId?: string; payload?: Record<string, unknown> } }).event;
    expect(event?.name).toBe("image.generated");
    expect(event?.correlationId).toBe(CID);
    expect(gen.meta.correlationId).toBe(CID);

    // 4. Audit-log: forward the emitted event (what the host does).
    const recorded = await recordEvent(
      {
        eventName: event!.name,
        actorId: verified.data.claims.sub,
        entityType: "image",
        entityId: (gen.data as { id: string }).id,
        source: "image-generation",
        payload: event!.payload,
      },
      { auditStore },
    );
    expect(recorded.ok).toBe(true);

    // 5. The image.generated event is queryable in the audit trail.
    const events = await listEvents({ eventName: "image.generated" }, { auditStore });
    expect(events.ok).toBe(true);
    if (events.ok) {
      expect(events.data.events.length).toBe(1);
      expect(events.data.events[0].actorId).toBe("user-1");
      expect(events.data.events[0].entityType).toBe("image");
    }
  });

  it("a caller missing image.generate is rejected by the scope gate (403) before any generation", async () => {
    const keys = await authStore();
    const minted = await mintToken(
      { subject: "user-2", workspace: "w1", project: "p1", scopes: ["image.read"] },
      { signingKeyStore: keys },
    );
    if (!minted.ok) throw new Error("mint failed");
    const verified = await verifyToken({ token: minted.data.token }, { signingKeyStore: keys });
    if (!verified.ok) throw new Error("verify failed");

    const gate = requireScope(verified.data.claims, "image.generate");
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.status).toBe(403);
  });

  it("delete emits image.deleted which is recorded to the audit trail", async () => {
    const auditStore = createMemoryAuditEventStore();
    const deps = imageDeps();
    const gen = await generateImage({ tenantId: "user-3", prompt: "a blue cat", aspectRatio: "1:1" }, deps);
    if (!gen.ok) throw new Error("generate failed");

    const del = await deleteImage({ tenantId: "user-3", imageId: (gen.data as { id: string }).id }, { store: deps.store, storage: deps.storage });
    expect(del.ok).toBe(true);
    if (!del.ok) return;
    const event = (del.data as { event?: { name: string; payload?: Record<string, unknown> } }).event;
    await recordEvent(
      { eventName: event!.name, actorId: "user-3", entityType: "image", source: "image-generation", payload: event!.payload },
      { auditStore },
    );

    const events = await listEvents({ eventName: "image.deleted" }, { auditStore });
    expect(events.ok && events.data.events.length).toBe(1);
  });
});
