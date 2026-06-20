import { describe, expect, it } from "vitest";
import { createOpsTokenVerifier, mintOpsToken } from "../src/index.js";

const NOW = 1_750_000_000_000;

// GOLDEN VECTOR — pins the exact wire format. Any change to the token encoding
// breaks this test. Both the minter (control-plane provisioning) and the verifier
// (operate app) consume THIS package, so this single vector guarantees they agree
// byte-for-byte. Do not "fix" this string to match new output — that is a
// breaking format change that invalidates every issued token.
const GOLDEN_SECRET = "golden-secret";
const GOLDEN_CLAIMS = { ownerId: "ws_golden", scopes: ["ops.invoice.read"], exp: NOW };
const GOLDEN_TOKEN =
  "eyJvd25lcklkIjoid3NfZ29sZGVuIiwic2NvcGVzIjpbIm9wcy5pbnZvaWNlLnJlYWQiXSwiZXhwIjoxNzUwMDAwMDAwMDAwfQ.fYDZZCE8KhUN1m7jFAyV9L_Gb-f57xMZyAdw8HHLXwM";

describe("ops-token codec", () => {
  it("mints the golden vector (wire-format lock)", async () => {
    expect(await mintOpsToken(GOLDEN_CLAIMS, { secret: GOLDEN_SECRET })).toBe(GOLDEN_TOKEN);
  });

  it("verifies the golden vector before expiry", async () => {
    const verifier = createOpsTokenVerifier({ secret: GOLDEN_SECRET, now: () => NOW - 1 });
    const r = await verifier.verify(GOLDEN_TOKEN);
    expect(r).toEqual({ ok: true, ownerId: "ws_golden", scopes: ["ops.invoice.read"] });
  });

  it("mint→verify round-trips owner + scopes", async () => {
    const token = await mintOpsToken({ ownerId: "owner_1", scopes: ["ops.invoice.read", "ops.booking.read"], exp: NOW + 60_000 }, { secret: "s" });
    const r = await createOpsTokenVerifier({ secret: "s", now: () => NOW }).verify(token);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("expected ok");
    expect(r.ownerId).toBe("owner_1");
    expect(r.scopes).toEqual(["ops.invoice.read", "ops.booking.read"]);
  });

  it("rejects wrong secret, tamper, and expiry", async () => {
    const token = await mintOpsToken({ ownerId: "o", scopes: [], exp: NOW + 60_000 }, { secret: "right" });
    expect((await createOpsTokenVerifier({ secret: "wrong", now: () => NOW }).verify(token)).ok).toBe(false);
    expect((await createOpsTokenVerifier({ secret: "right", now: () => NOW }).verify(`${token}x`)).ok).toBe(false);
    const expired = await mintOpsToken({ ownerId: "o", scopes: [], exp: NOW - 1 }, { secret: "right" });
    expect((await createOpsTokenVerifier({ secret: "right", now: () => NOW }).verify(expired)).ok).toBe(false);
  });

  it("rejects malformed tokens", async () => {
    const v = createOpsTokenVerifier({ secret: "s", now: () => NOW });
    expect((await v.verify("garbage")).ok).toBe(false);
    expect((await v.verify("")).ok).toBe(false);
  });
});
