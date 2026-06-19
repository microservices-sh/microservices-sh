import { describe, it, expect, beforeEach } from "vitest";
import { beginRegistration } from "../../src/use-cases/begin-registration";
import { verifyRegistration } from "../../src/use-cases/verify-registration";
import { createMemoryPasskeyStore } from "../../src/adapters/memory-passkey-store";
import type { PasskeyStore } from "../../src/ports";
import type { Verifiers } from "../../src/webauthn";

let clock = 1_700_000_000_000;
const now = () => clock;

// Fake verifier: no real attestation crypto. Records calls so we can assert orchestration.
function fakeVerifiers(over: Partial<Verifiers> = {}): Verifiers {
  return {
    async generateRegistration() {
      return { challenge: "gen-reg-chal", rp: { id: "example.com", name: "Example" } } as never;
    },
    async verifyRegistration(input) {
      return {
        verified: true,
        credential: {
          id: "new-cred-id",
          publicKey: "new-pub-key",
          counter: 0,
          transports: ["internal"],
          deviceType: "multiDevice",
          backedUp: true,
        },
        // expose what it was called with for assertions
        _input: input,
      } as never;
    },
    async generateAuthentication() {
      return { challenge: "x" } as never;
    },
    async verifyAuthentication() {
      return { verified: true, newCounter: 1 };
    },
    ...over,
  };
}

const RP = { rpId: "example.com", rpName: "Example", origins: ["https://example.com"] };

describe("beginRegistration", () => {
  let store: PasskeyStore;
  beforeEach(() => {
    store = createMemoryPasskeyStore();
    clock = 1_700_000_000_000;
  });

  it("generates options and stores a reg:<userId> challenge", async () => {
    const user = { id: "user_1", name: "Ann", identifier: "ann@example.com" };
    const res = await beginRegistration({ user, ...RP }, { store, verifiers: fakeVerifiers(), now });
    expect(res.ok).toBe(true);
    const stored = await store.getChallenge("reg:user_1");
    expect(stored?.challenge).toBe("gen-reg-chal");
    expect(stored?.userId).toBe("user_1");
    expect(stored?.expiresAt).toBeGreaterThan(clock);
  });

  it("rejects a missing user id", async () => {
    const res = await beginRegistration(
      { user: { id: "", name: "x", identifier: "x@y.com" }, ...RP },
      { store, verifiers: fakeVerifiers(), now }
    );
    expect(res.ok).toBe(false);
    expect((res as { status: number }).status).toBe(400);
  });

  it("excludes the user's existing credentials", async () => {
    await store.saveCredential({
      id: "pk_x", userId: "user_1", credentialId: "existing-cred", publicKey: "p",
      counter: 0, name: "old", transports: ["internal"], deviceType: null, backedUp: false,
      createdAt: 0, lastUsedAt: null,
    });
    let seen: { id: string }[] = [];
    const verifiers = fakeVerifiers({
      async generateRegistration(input) {
        seen = input.excludeCredentials;
        return { challenge: "gen-reg-chal" } as never;
      },
    });
    await beginRegistration(
      { user: { id: "user_1", name: "Ann", identifier: "ann@example.com" }, ...RP },
      { store, verifiers, now }
    );
    expect(seen.map((c) => c.id)).toContain("existing-cred");
  });
});

describe("verifyRegistration", () => {
  let store: PasskeyStore;
  beforeEach(() => {
    store = createMemoryPasskeyStore();
    clock = 1_700_000_000_000;
  });

  async function begin(userId = "user_1") {
    await beginRegistration(
      { user: { id: userId, name: "Ann", identifier: "ann@example.com" }, ...RP },
      { store, verifiers: fakeVerifiers(), now }
    );
  }

  it("persists the credential, consumes the challenge, emits passkey.registered", async () => {
    await begin();
    const emitted: { name: string; payload: unknown }[] = [];
    const res = await verifyRegistration(
      { userId: "user_1", response: {} as never, ...RP },
      { store, verifiers: fakeVerifiers(), now, emit: (name, payload) => emitted.push({ name, payload }) }
    );
    expect(res.ok).toBe(true);
    const saved = await store.getCredentialById("new-cred-id");
    expect(saved?.userId).toBe("user_1");
    expect(saved?.counter).toBe(0);
    expect(await store.getChallenge("reg:user_1")).toBeNull(); // consumed
    expect(emitted.map((e) => e.name)).toContain("passkey.registered");
  });

  it("rejects when no challenge exists (expired / never started)", async () => {
    const res = await verifyRegistration(
      { userId: "user_1", response: {} as never, ...RP },
      { store, verifiers: fakeVerifiers(), now }
    );
    expect(res.ok).toBe(false);
    expect((res as { status: number }).status).toBe(400);
  });

  it("rejects an expired challenge", async () => {
    await begin();
    clock += 10 * 60 * 1000; // > 5min TTL
    const res = await verifyRegistration(
      { userId: "user_1", response: {} as never, ...RP },
      { store, verifiers: fakeVerifiers(), now }
    );
    expect(res.ok).toBe(false);
    expect((res as { status: number }).status).toBe(400);
  });

  it("rejects when the verifier reports verified=false and saves nothing", async () => {
    await begin();
    const res = await verifyRegistration(
      { userId: "user_1", response: {} as never, ...RP },
      { store, verifiers: fakeVerifiers({ async verifyRegistration() { return { verified: false }; } }), now }
    );
    expect(res.ok).toBe(false);
    expect(await store.getCredentialById("new-cred-id")).toBeNull();
  });
});
