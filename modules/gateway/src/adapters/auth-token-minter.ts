import { mintToken } from "@microservices-sh/auth";
import type { SigningKeyStore } from "@microservices-sh/auth/ports";
import type { TokenMinter } from "../ports";
import type { MintOutcome, MintRequest } from "../types";

function toOutcome(result: Awaited<ReturnType<typeof mintToken>>): MintOutcome {
  if (result.ok) {
    return { ok: true, token: result.data.token, claims: result.data.claims as unknown as Record<string, unknown> };
  }
  return { ok: false, status: result.status, error: result.error };
}

// Embedded mode: the gateway mints in-process via the auth module's use case.
export function createLocalTokenMinter(deps: { signingKeyStore: SigningKeyStore }): TokenMinter {
  return {
    async mint(request: MintRequest) {
      return toOutcome(await mintToken(request, { signingKeyStore: deps.signingKeyStore }));
    }
  };
}

interface AuthBinding {
  mintToken(input: MintRequest, token?: string): Promise<MintOutcome>;
}

// Service mode: the gateway calls the auth service binding, presenting its own
// service token (which must carry the auth.mint scope).
export function createBindingTokenMinter(authBinding: AuthBinding, callerToken: string): TokenMinter {
  return {
    async mint(request: MintRequest) {
      return authBinding.mintToken(request, callerToken);
    }
  };
}
