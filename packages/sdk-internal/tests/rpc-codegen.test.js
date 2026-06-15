import { describe, it, expect } from "vitest";
import {
  rpcMethods,
  serviceClassName,
  generateRpcEntrypoint,
  generateRpcClient,
} from "../src/rpc-codegen.js";

const paymentConnections = {
  id: "payment",
  connections: { rpc: { exposes: [{ method: "createPaymentIntent", scope: "payment.write", public: false }] } },
};
const authConnections = {
  id: "auth",
  connections: {
    rpc: {
      exposes: [
        { method: "mintToken", scope: "auth.mint", public: false },
        { method: "getJwks", scope: null, public: true },
      ],
    },
  },
};
const paymentFlat = { id: "payment", rpc: [{ method: "createPaymentIntent", scope: "payment.write", public: false }] };

describe("rpcMethods", () => {
  it("reads connections.rpc.exposes", () => {
    expect(rpcMethods(paymentConnections).map((m) => m.method)).toEqual(["createPaymentIntent"]);
  });
  it("falls back to legacy flat rpc (phase3 transition)", () => {
    expect(rpcMethods(paymentFlat).map((m) => m.method)).toEqual(["createPaymentIntent"]);
  });
  it("returns [] when neither present", () => {
    expect(rpcMethods({ id: "x" })).toEqual([]);
  });
});

describe("generateRpcEntrypoint", () => {
  it("emits a WorkerEntrypoint with the exposed method + scope", () => {
    const code = generateRpcEntrypoint(paymentConnections);
    expect(code).toContain("export class PaymentService extends WorkerEntrypoint");
    expect(code).toContain("async createPaymentIntent(");
    expect(code).toContain('import { rpcContract } from "@microservices-sh/payment/rpc";');
  });
  it("auth verifies tokens itself (verify=self)", () => {
    const code = generateRpcEntrypoint(authConnections);
    expect(code).toContain("verifyToken as verifyCallerToken");
    expect(code).toContain("class AuthService extends WorkerEntrypoint");
  });
  it("non-auth modules verify via the AUTH binding (verify=binding)", () => {
    const code = generateRpcEntrypoint(paymentConnections);
    expect(code).toContain("this.env.AUTH.verifyToken(token)");
    expect(code).not.toContain("verifyCallerToken");
  });
  it("returns null for modules without an adapter deps spec", () => {
    // forms-intake has no SERVICE_SPECS entry → entrypoint not generated (deps unknown)
    expect(generateRpcEntrypoint({ id: "forms-intake", connections: { rpc: { exposes: [{ method: "x", scope: null, public: true }] } } })).toBeNull();
  });
});

describe("generateRpcClient", () => {
  it("emits a typed client interface for the exposed methods", () => {
    const code = generateRpcClient(paymentConnections);
    expect(code).toContain("export interface PaymentRpc");
    expect(code).toContain("createPaymentIntent(input: unknown, token?: string): Promise<unknown>;");
    expect(code).toContain("export function getPaymentService(");
  });
  it("serviceClassName", () => {
    expect(serviceClassName("audit-log")).toBe("AuditLogService");
  });
});
