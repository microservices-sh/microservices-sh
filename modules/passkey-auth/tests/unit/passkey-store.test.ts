import { describe, it, expect, beforeEach } from "vitest";
import { createMemoryPasskeyStore } from "../../src/adapters/memory-passkey-store";
import type { PasskeyStore } from "../../src/ports";
import type { ChallengeRecord, CredentialRecord } from "../../src/types";

// Canonical port-contract coverage. Run against createMemoryPasskeyStore(); the D1
// adapter implements the same interface and is integration-tested later in api/.

function challenge(over: Partial<ChallengeRecord> = {}): ChallengeRecord {
  return {
    challengeKey: "reg:user_1",
    challenge: "chal-abc",
    userId: "user_1",
    createdAt: 1000,
    expiresAt: 1000 + 300_000,
    ...over,
  };
}

function credential(over: Partial<CredentialRecord> = {}): CredentialRecord {
  return {
    id: "pk_1",
    userId: "user_1",
    credentialId: "cred-abc",
    publicKey: "pub-abc",
    counter: 0,
    name: "Test Passkey",
    transports: ["internal"],
    deviceType: "multiDevice",
    backedUp: true,
    createdAt: 1000,
    lastUsedAt: null,
    ...over,
  };
}

describe("PasskeyStore contract (memory)", () => {
  let store: PasskeyStore;
  beforeEach(() => {
    store = createMemoryPasskeyStore();
  });

  describe("challenge lifecycle", () => {
    it("puts and gets a challenge", async () => {
      await store.putChallenge(challenge());
      const got = await store.getChallenge("reg:user_1");
      expect(got?.challenge).toBe("chal-abc");
      expect(got?.userId).toBe("user_1");
    });

    it("returns null for an unknown challenge", async () => {
      expect(await store.getChallenge("login:nope")).toBeNull();
    });

    it("upserts by key (a new ceremony replaces the outstanding challenge)", async () => {
      await store.putChallenge(challenge({ challenge: "first" }));
      await store.putChallenge(challenge({ challenge: "second" }));
      expect((await store.getChallenge("reg:user_1"))?.challenge).toBe("second");
    });

    it("deletes a challenge (single-use consumption)", async () => {
      await store.putChallenge(challenge());
      await store.deleteChallenge("reg:user_1");
      expect(await store.getChallenge("reg:user_1")).toBeNull();
    });

    it("returns a copy — mutating the result does not corrupt the store", async () => {
      await store.putChallenge(challenge());
      const got = (await store.getChallenge("reg:user_1"))!;
      got.challenge = "tampered";
      expect((await store.getChallenge("reg:user_1"))?.challenge).toBe("chal-abc");
    });
  });

  describe("credentials", () => {
    it("saves and reads back by credentialId", async () => {
      await store.saveCredential(credential());
      const got = await store.getCredentialById("cred-abc");
      expect(got?.userId).toBe("user_1");
      expect(got?.counter).toBe(0);
    });

    it("returns null for an unknown credentialId", async () => {
      expect(await store.getCredentialById("cred-nope")).toBeNull();
    });

    it("lists credentials scoped to the owning user", async () => {
      await store.saveCredential(credential({ id: "pk_1", credentialId: "cred-a", userId: "user_1" }));
      await store.saveCredential(credential({ id: "pk_2", credentialId: "cred-b", userId: "user_1" }));
      await store.saveCredential(credential({ id: "pk_3", credentialId: "cred-c", userId: "user_2" }));
      const mine = await store.getCredentialsByUser("user_1");
      expect(mine.map((c) => c.credentialId).sort()).toEqual(["cred-a", "cred-b"]);
      expect(await store.getCredentialsByUser("user_2")).toHaveLength(1);
    });

    it("updates the signature counter and last-used", async () => {
      await store.saveCredential(credential({ counter: 0 }));
      await store.updateCounter("cred-abc", 5, 9999);
      const got = await store.getCredentialById("cred-abc");
      expect(got?.counter).toBe(5);
      expect(got?.lastUsedAt).toBe(9999);
    });

    it("deletes a credential scoped to the owner; rejects cross-user delete", async () => {
      await store.saveCredential(credential({ credentialId: "cred-abc", userId: "user_1" }));
      expect(await store.deleteCredential("cred-abc", "user_2")).toBe(false); // wrong owner
      expect(await store.getCredentialById("cred-abc")).not.toBeNull();
      expect(await store.deleteCredential("cred-abc", "user_1")).toBe(true);
      expect(await store.getCredentialById("cred-abc")).toBeNull();
    });

    it("returns copies — mutating a listed credential does not corrupt the store", async () => {
      await store.saveCredential(credential());
      const [c] = await store.getCredentialsByUser("user_1");
      c.counter = 999;
      c.transports.push("hybrid");
      const fresh = await store.getCredentialById("cred-abc");
      expect(fresh?.counter).toBe(0);
      expect(fresh?.transports).toEqual(["internal"]);
    });
  });
});
