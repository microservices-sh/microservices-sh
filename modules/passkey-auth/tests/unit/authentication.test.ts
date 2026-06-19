import { describe, it, expect, beforeEach } from "vitest";
import { beginAuthentication } from "../../src/use-cases/begin-authentication";
import { verifyAuthentication } from "../../src/use-cases/verify-authentication";
import { createMemoryPasskeyStore } from "../../src/adapters/memory-passkey-store";
import type { PasskeyStore } from "../../src/ports";
import type { Verifiers } from "../../src/webauthn";

let clock = 1_700_000_000_000;
const now = () => clock;

function fakeVerifiers(over: Partial<Verifiers> = {}): Verifiers {
  return {
    async generateRegistration() { return { challenge: "x" } as never; },
    async verifyRegistration() { return { verified: false }; },
    async generateAuthentication() {
      return { challenge: "gen-auth-chal", allowCredentials: [] } as never;
    },
    async verifyAuthentication(input) {
      // Default fake: succeed and report counter+1 from the supplied stored counter.
      return { verified: true, newCounter: input.credential.counter + 1 };
    },
    ...over,
  };
}

const RP = { rpId: "example.com", origins: ["https://example.com"] };

async function seedCredential(store: PasskeyStore, over: Partial<{ counter: number; userId: string; credentialId: string }> = {}) {
  await store.saveCredential({
    id: "pk_1",
    userId: over.userId ?? "user_1",
    credentialId: over.credentialId ?? "cred-1",
    publicKey: "pub-1",
    counter: over.counter ?? 0,
    name: "Test",
    transports: ["internal"],
    deviceType: "multiDevice",
    backedUp: true,
    createdAt: 0,
    lastUsedAt: null,
  });
}

describe("beginAuthentication", () => {
  let store: PasskeyStore;
  beforeEach(() => {
    store = createMemoryPasskeyStore();
    clock = 1_700_000_000_000;
  });

  it("generates options and stores a login:<uuid> challenge with null user", async () => {
    const res = await beginAuthentication({ ...RP }, { store, verifiers: fakeVerifiers(), now });
    expect(res.ok).toBe(true);
    const key = (res as { data: { challengeKey: string } }).data.challengeKey;
    expect(key).toMatch(/^login:/);
    const stored = await store.getChallenge(key);
    expect(stored?.challenge).toBe("gen-auth-chal");
    expect(stored?.userId).toBeNull();
  });
});

describe("verifyAuthentication", () => {
  let store: PasskeyStore;
  beforeEach(() => {
    store = createMemoryPasskeyStore();
    clock = 1_700_000_000_000;
  });

  async function begin() {
    const res = await beginAuthentication({ ...RP }, { store, verifiers: fakeVerifiers(), now });
    return (res as { data: { challengeKey: string } }).data.challengeKey;
  }

  it("verifies an assertion and RETURNS userId (does NOT mint a session)", async () => {
    await seedCredential(store, { counter: 3 });
    const challengeKey = await begin();
    const emitted: string[] = [];
    const res = await verifyAuthentication(
      { response: { id: "cred-1" } as never, challengeKey, ...RP },
      { store, verifiers: fakeVerifiers(), now, emit: (n) => emitted.push(n) }
    );
    expect(res.ok).toBe(true);
    const data = (res as { data: Record<string, unknown> }).data;
    expect(data.userId).toBe("user_1");
    // No session token / session id of any kind is returned.
    expect(data).not.toHaveProperty("sessionId");
    expect(data).not.toHaveProperty("sessionToken");
    expect(emitted).toContain("passkey.authenticated");
  });

  it("bumps the stored signature counter to newCounter", async () => {
    await seedCredential(store, { counter: 3 });
    const challengeKey = await begin();
    await verifyAuthentication(
      { response: { id: "cred-1" } as never, challengeKey, ...RP },
      { store, verifiers: fakeVerifiers({ async verifyAuthentication() { return { verified: true, newCounter: 9 }; } }), now }
    );
    expect((await store.getCredentialById("cred-1"))?.counter).toBe(9);
  });

  it("REPLAY PROTECTION: rejects a non-increasing counter and does not bump", async () => {
    await seedCredential(store, { counter: 5 });
    const challengeKey = await begin();
    // Cloned authenticator replays an old assertion -> newCounter regresses.
    const res = await verifyAuthentication(
      { response: { id: "cred-1" } as never, challengeKey, ...RP },
      { store, verifiers: fakeVerifiers({ async verifyAuthentication() { return { verified: true, newCounter: 4 }; } }), now }
    );
    expect(res.ok).toBe(false);
    expect((res as { status: number }).status).toBe(401);
    expect((await store.getCredentialById("cred-1"))?.counter).toBe(5); // unchanged
  });

  it("REPLAY PROTECTION: rejects an equal counter (newCounter === stored)", async () => {
    await seedCredential(store, { counter: 5 });
    const challengeKey = await begin();
    const res = await verifyAuthentication(
      { response: { id: "cred-1" } as never, challengeKey, ...RP },
      { store, verifiers: fakeVerifiers({ async verifyAuthentication() { return { verified: true, newCounter: 5 }; } }), now }
    );
    expect(res.ok).toBe(false);
    expect((res as { status: number }).status).toBe(401);
  });

  it("allows equal counters only when both are 0 (authenticator without a counter)", async () => {
    await seedCredential(store, { counter: 0 });
    const challengeKey = await begin();
    const res = await verifyAuthentication(
      { response: { id: "cred-1" } as never, challengeKey, ...RP },
      { store, verifiers: fakeVerifiers({ async verifyAuthentication() { return { verified: true, newCounter: 0 }; } }), now }
    );
    expect(res.ok).toBe(true);
  });

  it("rejects an unknown credential (401)", async () => {
    const challengeKey = await begin();
    const res = await verifyAuthentication(
      { response: { id: "cred-unknown" } as never, challengeKey, ...RP },
      { store, verifiers: fakeVerifiers(), now }
    );
    expect(res.ok).toBe(false);
    expect((res as { status: number }).status).toBe(401);
  });

  it("rejects an expired / missing challenge (consumed single-use)", async () => {
    await seedCredential(store);
    const challengeKey = await begin();
    clock += 10 * 60 * 1000; // > TTL
    const res = await verifyAuthentication(
      { response: { id: "cred-1" } as never, challengeKey, ...RP },
      { store, verifiers: fakeVerifiers(), now }
    );
    expect(res.ok).toBe(false);
    expect((res as { status: number }).status).toBe(400);
  });

  it("rejects when the verifier reports verified=false (401), counter unchanged", async () => {
    await seedCredential(store, { counter: 2 });
    const challengeKey = await begin();
    const res = await verifyAuthentication(
      { response: { id: "cred-1" } as never, challengeKey, ...RP },
      { store, verifiers: fakeVerifiers({ async verifyAuthentication() { return { verified: false, newCounter: 0 }; } }), now }
    );
    expect(res.ok).toBe(false);
    expect((res as { status: number }).status).toBe(401);
    expect((await store.getCredentialById("cred-1"))?.counter).toBe(2);
  });

  it("consumes the challenge so it cannot be reused", async () => {
    await seedCredential(store);
    const challengeKey = await begin();
    await verifyAuthentication(
      { response: { id: "cred-1" } as never, challengeKey, ...RP },
      { store, verifiers: fakeVerifiers(), now }
    );
    expect(await store.getChallenge(challengeKey)).toBeNull();
  });
});
