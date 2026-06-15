import { describe, it, expect, beforeEach } from "vitest";
import {
  requestLoginCode,
  verifyLoginCode,
  readSession,
  destroySession,
  mintSessionToken,
  serializeSessionCookie,
  clearSessionCookie,
  parseSessionCookie,
  createMemoryAccountStore,
  createMemoryLoginCodeStore,
  createMemorySessionStore,
} from "../src/index";
import { sha256Hex } from "../src/crypto";
import {
  verifyToken,
  rotateSigningKey,
  requireScope,
  createMemorySigningKeyStore,
} from "@microservices-sh/auth";

// Deterministic clock so expiry/attempt logic is testable without sleeps.
let clock = 1_700_000_000_000;
const now = () => clock;
const advance = (seconds: number) => {
  clock += seconds * 1000;
};

function stores() {
  return {
    accountStore: createMemoryAccountStore(),
    loginCodeStore: createMemoryLoginCodeStore(),
    sessionStore: createMemorySessionStore(),
  };
}

// Pull the issued code out of the (enveloped) request result.
async function issue(s: ReturnType<typeof stores>, email: string, adminEmails: string[] = []) {
  const res = await requestLoginCode({ email }, { ...s, adminEmails, now });
  expect(res.ok).toBe(true);
  return (res as { data: { code: string } }).data.code;
}

describe("passwordless login code", () => {
  let s: ReturnType<typeof stores>;
  beforeEach(() => {
    s = stores();
    clock = 1_700_000_000_000;
  });

  it("stores a salted HASH of the code, never the plaintext", async () => {
    const code = await issue(s, "User@Example.com");
    const rec = await s.loginCodeStore.getByEmail("user@example.com"); // email normalized
    expect(rec).not.toBeNull();
    expect(rec!.codeHash).not.toBe(code);
    expect(rec!.codeHash).toHaveLength(64); // sha256 hex
    expect(rec!.codeHash).toBe(await sha256Hex(`user@example.com:${code}`));
  });

  it("rejects a malformed email", async () => {
    const res = await requestLoginCode({ email: "nope" }, { ...s, now });
    expect(res.ok).toBe(false);
    expect((res as { status: number }).status).toBe(400);
  });

  it("provisions an account; adminEmails get isAdmin", async () => {
    await issue(s, "boss@acme.com", ["boss@acme.com"]);
    await issue(s, "joe@acme.com", ["boss@acme.com"]);
    expect((await s.accountStore.findByEmail("boss@acme.com"))!.isAdmin).toBe(true);
    expect((await s.accountStore.findByEmail("joe@acme.com"))!.isAdmin).toBe(false);
  });

  it("verifies a correct code -> session + user; wrong code -> 401 and increments attempts", async () => {
    const code = await issue(s, "a@b.com");
    const bad = await verifyLoginCode({ email: "a@b.com", code: "000000" === code ? "111111" : "000000" }, { ...s, now });
    expect(bad.ok).toBe(false);
    expect((bad as { status: number }).status).toBe(401);
    expect((await s.loginCodeStore.getByEmail("a@b.com"))!.attempts).toBe(1);

    const good = await verifyLoginCode({ email: "a@b.com", code }, { ...s, now });
    expect(good.ok).toBe(true);
    const data = (good as { data: { sessionId: string; user: { email: string } } }).data;
    expect(data.sessionId).toMatch(/^ses_/);
    expect(data.user.email).toBe("a@b.com");
  });

  it("rejects an expired code", async () => {
    const code = await issue(s, "a@b.com");
    advance(601); // > 600s TTL
    const res = await verifyLoginCode({ email: "a@b.com", code }, { ...s, now });
    expect(res.ok).toBe(false);
    expect((res as { status: number }).status).toBe(401);
  });

  it("is single-use: a consumed code cannot be replayed", async () => {
    const code = await issue(s, "a@b.com");
    expect((await verifyLoginCode({ email: "a@b.com", code }, { ...s, now })).ok).toBe(true);
    const replay = await verifyLoginCode({ email: "a@b.com", code }, { ...s, now });
    expect(replay.ok).toBe(false);
    expect((replay as { status: number }).status).toBe(401);
  });

  it("locks after too many wrong attempts (429)", async () => {
    await issue(s, "a@b.com");
    for (let i = 0; i < 5; i += 1) {
      await verifyLoginCode({ email: "a@b.com", code: "999999" }, { ...s, now });
    }
    const res = await verifyLoginCode({ email: "a@b.com", code: "999999" }, { ...s, now });
    expect((res as { status: number }).status).toBe(429);
  });
});

describe("sessions", () => {
  it("reads an active session, fails closed on expiry/unknown, refreshes rolling", async () => {
    const s = stores();
    clock = 1_700_000_000_000;
    const code = await issue(s, "a@b.com");
    const sid = (await verifyLoginCode({ email: "a@b.com", code }, { ...s, now }) as { data: { sessionId: string } }).data.sessionId;

    const read = await readSession({ sessionId: sid }, { ...s, now });
    expect((read as { data: { user: { email: string } | null } }).data.user?.email).toBe("a@b.com");

    expect((await readSession({ sessionId: "ses_nope" }, { ...s, now }) as { data: { user: unknown } }).data.user).toBeNull();

    advance(60 * 60 * 24 * 31); // > 30d, but rolling refresh happened on the read above...
    // read again pushes expiry forward each call; jump beyond a fresh window with no read:
    const stale = await readSession({ sessionId: sid }, { ...s, now });
    expect((stale as { data: { user: unknown } }).data.user).toBeNull();
  });

  it("destroySession ends the session", async () => {
    const s = stores();
    clock = 1_700_000_000_000;
    const code = await issue(s, "a@b.com");
    const sid = (await verifyLoginCode({ email: "a@b.com", code }, { ...s, now }) as { data: { sessionId: string } }).data.sessionId;
    await destroySession({ sessionId: sid }, { sessionStore: s.sessionStore, now });
    expect((await readSession({ sessionId: sid }, { ...s, now }) as { data: { user: unknown } }).data.user).toBeNull();
  });
});

describe("session cookie", () => {
  it("round-trips and clears", () => {
    const cookie = serializeSessionCookie("ses_abc", { secure: false });
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(parseSessionCookie(cookie.split(";")[0] + "; other=1")).toBe("ses_abc");
    expect(parseSessionCookie(clearSessionCookie().split(";")[0])).toBeNull();
    expect(parseSessionCookie(null)).toBeNull();
  });
});

describe("end-to-end: login -> session -> bridge -> scoped token", () => {
  async function signingStore() {
    const store = createMemorySigningKeyStore();
    await rotateSigningKey({ signingKeyStore: store });
    return store;
  }

  it("admin login yields a token verifying with gateway.admin; customer does not", async () => {
    const s = stores();
    clock = 1_700_000_000_000;
    const ks = await signingStore();

    // admin
    const aCode = await issue(s, "admin@acme.com", ["admin@acme.com"]);
    const aUser = (await verifyLoginCode({ email: "admin@acme.com", code: aCode }, { ...s, now }) as { data: { user: { id: string; email: string; isAdmin: boolean } } }).data.user;
    const aTok = await mintSessionToken(aUser, { signingKeyStore: ks, workspace: "w", project: "p", now });
    const aVer = await verifyToken((aTok as { data: { token: string } }).data.token, { signingKeyStore: ks, now });
    expect(aVer.ok).toBe(true);
    expect(requireScope((aVer as { data: { claims: { scopes: string[] } } }).data.claims as never, "gateway.admin").ok).toBe(true);

    // customer
    const cCode = await issue(s, "cust@acme.com");
    const cUser = (await verifyLoginCode({ email: "cust@acme.com", code: cCode }, { ...s, now }) as { data: { user: { id: string; email: string; isAdmin: boolean } } }).data.user;
    const cTok = await mintSessionToken(cUser, { signingKeyStore: ks, workspace: "w", project: "p", now });
    const cVer = await verifyToken((cTok as { data: { token: string } }).data.token, { signingKeyStore: ks, now });
    expect(requireScope((cVer as { data: { claims: { scopes: string[] } } }).data.claims as never, "gateway.admin").ok).toBe(false);
  });
});
