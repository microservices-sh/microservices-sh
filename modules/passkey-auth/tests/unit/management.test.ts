import { describe, it, expect, beforeEach } from "vitest";
import { listCredentials } from "../../src/use-cases/list-credentials";
import { deleteCredential } from "../../src/use-cases/delete-credential";
import { createMemoryPasskeyStore } from "../../src/adapters/memory-passkey-store";
import type { PasskeyStore } from "../../src/ports";

const now = () => 1_700_000_000_000;

async function seed(store: PasskeyStore, userId: string, credentialId: string, name: string, createdAt: number) {
  await store.saveCredential({
    id: `pk_${credentialId}`,
    userId,
    credentialId,
    publicKey: "pub",
    counter: 0,
    name,
    transports: ["internal"],
    deviceType: null,
    backedUp: false,
    createdAt,
    lastUsedAt: null,
  });
}

describe("listCredentials", () => {
  let store: PasskeyStore;
  beforeEach(() => { store = createMemoryPasskeyStore(); });

  it("lists only the requesting user's passkeys as summaries (no public key)", async () => {
    await seed(store, "user_1", "cred-a", "Laptop", 100);
    await seed(store, "user_1", "cred-b", "Phone", 200);
    await seed(store, "user_2", "cred-c", "Other", 300);

    const res = await listCredentials({ userId: "user_1" }, { store, now });
    expect(res.ok).toBe(true);
    const items = (res as unknown as { data: { credentials: Array<Record<string, unknown>> } }).data.credentials;
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.credentialId).sort()).toEqual(["cred-a", "cred-b"]);
    // summary shape: no publicKey / counter leaked
    expect(items[0]).not.toHaveProperty("publicKey");
    expect(items[0]).not.toHaveProperty("counter");
    expect(items[0]).toHaveProperty("name");
  });

  it("rejects a missing userId", async () => {
    const res = await listCredentials({ userId: "" }, { store, now });
    expect(res.ok).toBe(false);
    expect((res as { status: number }).status).toBe(400);
  });
});

describe("deleteCredential", () => {
  let store: PasskeyStore;
  beforeEach(() => { store = createMemoryPasskeyStore(); });

  it("deletes a passkey owned by the user and emits passkey.credential_deleted", async () => {
    await seed(store, "user_1", "cred-a", "Laptop", 100);
    const emitted: string[] = [];
    const res = await deleteCredential(
      { userId: "user_1", credentialId: "cred-a" },
      { store, now, emit: (n) => emitted.push(n) }
    );
    expect(res.ok).toBe(true);
    expect(await store.getCredentialById("cred-a")).toBeNull();
    expect(emitted).toContain("passkey.credential_deleted");
  });

  it("refuses to delete another user's passkey (404, scoped) and emits nothing", async () => {
    await seed(store, "user_1", "cred-a", "Laptop", 100);
    const emitted: string[] = [];
    const res = await deleteCredential(
      { userId: "user_2", credentialId: "cred-a" },
      { store, now, emit: (n) => emitted.push(n) }
    );
    expect(res.ok).toBe(false);
    expect((res as { status: number }).status).toBe(404);
    expect(await store.getCredentialById("cred-a")).not.toBeNull(); // untouched
    expect(emitted).toHaveLength(0);
  });

  it("rejects missing input", async () => {
    const res = await deleteCredential({ userId: "user_1", credentialId: "" }, { store, now });
    expect(res.ok).toBe(false);
    expect((res as { status: number }).status).toBe(400);
  });
});
