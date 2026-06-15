import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { compose } from "@microservices-sh/connection-contract/composer";
import { createForm } from "../src/use-cases/create-form";
import { submitForm } from "../src/use-cases/submit-form";
import { createMemoryFormStore } from "../src/adapters/memory-form-store";

const formsManifest = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));

describe("forms-intake connections manifest", () => {
  it("composes standalone (no required deps, no rpc calls)", () => {
    const r = compose([
      { id: "forms-intake", grantedScopes: [], connections: formsManifest.connections },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.wiring.modules).toContain("forms-intake");
      expect(r.wiring.rpc).toEqual([]);
    }
  });

  it("declares typed hook points", () => {
    expect(formsManifest.connections.hookPoints.beforeFormPublish.kind).toBe("filter");
    expect(formsManifest.connections.hookPoints.onSubmissionReceived.kind).toBe("observer");
  });

  it("emits namespaced lifecycle events, consumes none", () => {
    expect(formsManifest.connections.events.emits).toContain("forms-intake.submission_received");
    expect(formsManifest.connections.events.consumes).toEqual([]);
  });
});

describe("createForm meta + namespaced codes", () => {
  it("threads correlationId into meta and the emitted event", async () => {
    const r = await createForm(
      {
        tenantId: "tenant-1",
        name: "Contact",
        fields: [{ id: "email", label: "Email", type: "email", required: true }],
      },
      { formStore: createMemoryFormStore(), correlationId: "corr-forms" }
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.event.correlationId).toBe("corr-forms");
      expect(r.data.event.name).toBe("forms-intake.form_created");
    }
    expect(r.meta.correlationId).toBe("corr-forms");
    expect(r.meta.source).toBe("forms-intake");
  });

  it("validation errors are namespaced and carry meta", async () => {
    const r = await createForm({}, { formStore: createMemoryFormStore() });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("forms-intake.INVALID_FORM_INPUT");
    expect(r.meta.source).toBe("forms-intake");
  });
});

describe("submitForm cross-module observer hook + meta", () => {
  it("runs the onSubmissionReceived observer chain and carries meta on success", async () => {
    const formStore = createMemoryFormStore();
    const created = await createForm(
      {
        tenantId: "tenant-1",
        name: "Contact",
        fields: [{ id: "email", label: "Email", type: "email", required: true }],
      },
      { formStore }
    );
    if (!created.ok) throw new Error("form creation failed");

    const seen: string[] = [];
    const observer = {
      kind: "observer" as const,
      order: 10,
      fn: async (s: any) => {
        seen.push(s.id);
      },
    };

    const r = await submitForm(
      { formId: created.data.id, tenantId: "tenant-1", values: { email: "a@b.com" } },
      { formStore, correlationId: "corr-sub", onSubmissionHooks: [observer] }
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.event?.correlationId).toBe("corr-sub");
      expect(seen).toHaveLength(1);
    }
    expect(r.meta.correlationId).toBe("corr-sub");
  });

  it("rejects an invalid submission with a namespaced code", async () => {
    const r = await submitForm({}, { formStore: createMemoryFormStore() });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("forms-intake.INVALID_SUBMISSION_INPUT");
    expect(r.meta.source).toBe("forms-intake");
  });
});
