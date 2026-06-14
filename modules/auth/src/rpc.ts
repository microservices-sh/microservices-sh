import { mintToken } from "./use-cases/mint-token";
import { verifyToken } from "./use-cases/verify-token";
import { getJwks } from "./use-cases/get-jwks";
import type { SigningKeyStore } from "./ports";

// Framework-neutral RPC contract descriptor (plans/24).
// Service-mode codegen consumes this to emit a `WorkerEntrypoint` subclass:
// each entry becomes an RPC method, `scope` is enforced against the caller's
// token, and `public` methods (JWKS) skip the token requirement. Handlers share
// a uniform `(input, deps)` signature so the generated dispatcher can call them
// without per-method special-casing; codegen wires `deps` from the Worker's
// bindings.
export interface RpcDeps {
  signingKeyStore: SigningKeyStore;
}

export interface RpcMethod {
  scope: string | null;
  public: boolean;
  description: string;
  handler: (input: unknown, deps: RpcDeps) => Promise<unknown>;
}

export const rpcContract: Record<string, RpcMethod> = {
  mintToken: {
    scope: "auth.mint",
    public: false,
    description: "Mint a short-lived EdDSA service token with actor + scopes.",
    handler: (input, deps) => mintToken(input, deps),
  },
  verifyToken: {
    scope: "auth.verify",
    public: false,
    description: "Verify a token signature and expiry; returns claims.",
    handler: (input, deps) => verifyToken(input, deps),
  },
  getJwks: {
    scope: null,
    public: true,
    description: "Public JWKS for local verification by other services.",
    handler: (_input, deps) => getJwks(deps),
  },
};

export type RpcContract = typeof rpcContract;
