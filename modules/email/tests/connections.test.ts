import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { compose } from "@microservices-sh/connection-contract/composer";
import { sendEmail } from "../src/use-cases/send-email";
import { createMemoryEmailRepository } from "../src/adapters/memory-email-repository";
import type { EmailProvider } from "../src/ports";

const manifest = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));

const stubProvider: EmailProvider = {
  id: "stub",
  async sendEmail() {
    return { ok: true, data: { provider: "stub", providerMessageId: "stub_1", status: "queued" } };
  }
};

const validInput = { from: "ops@example.com", to: ["a@example.com"], subject: "Hi", text: "hello" };
const deps = () => ({ provider: stubProvider, emailRepository: createMemoryEmailRepository() });

describe("email connections manifest", () => {
  it("composes standalone (no requires, no rpc.calls)", () => {
    const r = compose([
      { id: "email", grantedScopes: [], connections: manifest.connections },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.wiring.modules).toContain("email");
  });

  it("declares typed hook points", () => {
    expect(manifest.connections.hookPoints.beforeEmailSend.kind).toBe("filter");
    expect(manifest.connections.hookPoints.afterEmailQueued.kind).toBe("observer");
    expect(manifest.connections.hookPoints.afterEmailFailed.kind).toBe("observer");
  });

  it("emits its lifecycle events and consumes none", () => {
    expect(manifest.connections.events.emits).toContain("email.queued");
    expect(manifest.connections.events.emits).toContain("email.failed");
    expect(manifest.connections.events.consumes).toEqual([]);
  });
});

describe("sendEmail meta + namespaced errors", () => {
  it("threads correlationId through meta and the persisted event", async () => {
    const repo = createMemoryEmailRepository();
    const events: unknown[] = [];
    const recording = {
      ...repo,
      async writeEvent(event: { payload: Record<string, unknown> }) {
        events.push(event);
        return repo.writeEvent(event as never);
      }
    };
    const r = await sendEmail(validInput, {
      provider: stubProvider,
      emailRepository: recording,
      correlationId: "corr-x"
    });
    expect(r.ok).toBe(true);
    expect(r.meta.correlationId).toBe("corr-x");
    expect((events[0] as { payload: { correlationId: string } }).payload.correlationId).toBe("corr-x");
  });

  it("validation errors are namespaced and carry meta", async () => {
    const r = await sendEmail({}, deps());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("email.INVALID_EMAIL_INPUT");
    expect(r.meta.source).toBe("email");
  });
});
