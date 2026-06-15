import { describe, it, expect, beforeEach } from "vitest";
import { STATUS, statusFor, registerCodes, errorCode, __resetRegistry } from "../src/errors.js";

beforeEach(() => __resetRegistry());

describe("status map", () => {
  it("maps categories to status codes", () => {
    expect(statusFor("validation")).toBe(400);
    expect(statusFor("auth")).toBe(401);
    expect(statusFor("scope")).toBe(403);
    expect(statusFor("notFound")).toBe(404);
    expect(statusFor("conflict")).toBe(409);
    expect(statusFor("upstream")).toBe(502);
    expect(statusFor("internal")).toBe(500);
  });
  it("exposes STATUS table", () => {
    expect(STATUS.scope).toBe(403);
  });
  it("throws on unknown category", () => {
    expect(() => statusFor("nope")).toThrow();
  });
});

describe("error-code registry", () => {
  it("registers namespaced codes and builds the qualified code", () => {
    registerCodes("payment", ["INTENT_FAILED"]);
    expect(errorCode("payment", "INTENT_FAILED")).toBe("payment.INTENT_FAILED");
  });
  it("rejects an unregistered code", () => {
    registerCodes("payment", ["INTENT_FAILED"]);
    expect(() => errorCode("payment", "NOPE")).toThrow();
  });
  it("rejects duplicate registration of the same code", () => {
    registerCodes("payment", ["INTENT_FAILED"]);
    expect(() => registerCodes("payment", ["INTENT_FAILED"])).toThrow();
  });
});
