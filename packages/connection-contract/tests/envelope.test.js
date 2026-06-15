import { describe, it, expect } from "vitest";
import { ok, err, isOk, isErr } from "../src/envelope.js";

const meta = { requestId: "r1", correlationId: "c1", source: "auth", ts: "2026-06-15T00:00:00Z" };

describe("envelope", () => {
  it("ok() wraps data with meta", () => {
    const r = ok(200, { token: "x" }, meta);
    expect(r).toEqual({ ok: true, status: 200, data: { token: "x" }, meta });
    expect(isOk(r)).toBe(true);
    expect(isErr(r)).toBe(false);
  });
  it("err() wraps a structured error with meta", () => {
    const r = err(403, { code: "auth.FORBIDDEN_SCOPE", message: "no" }, meta);
    expect(r.ok).toBe(false);
    expect(r.status).toBe(403);
    expect(r.error.code).toBe("auth.FORBIDDEN_SCOPE");
    expect(r.meta).toEqual(meta);
    expect(isErr(r)).toBe(true);
  });
  it("err() rejects an error missing code/message", () => {
    expect(() => err(500, { message: "x" }, meta)).toThrow();
    expect(() => err(500, { code: "x.Y" }, meta)).toThrow();
  });
});
