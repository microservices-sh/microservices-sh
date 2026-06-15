/* ─────────────────────────────────────────────────────────────────────────
   Dependency factory for the auth use cases.

   The auth use cases take their persistence port (the signing-key store) as an
   injected dep. This factory wires the standard adapter in one place — D1 when a
   database binding is present (production), an in-memory store otherwise (local
   dev / tests) — so route adapters and tests don't each re-implement the choice.
   ───────────────────────────────────────────────────────────────────────── */
import { createD1SigningKeyStore } from "./adapters/d1-signing-key-store";
import { createMemorySigningKeyStore } from "./adapters/memory-signing-key-store";
import type { SigningKeyStore } from "./ports";

export interface AuthDeps {
  signingKeyStore: SigningKeyStore;
}

// The in-memory store is stateful; keep a singleton so keys minted in one call
// are still present for verification in the next (within a process).
let memoryDeps: AuthDeps | null = null;

/**
 * Build the auth signing-key store dependency.
 *
 * @param env Optional environment. Pass `{ DB }` (a Cloudflare D1 binding) for
 *            production persistence; omit it to use the in-memory store.
 */
export function createAuthDeps(env?: { DB?: D1Database }): AuthDeps {
  if (env?.DB) {
    return { signingKeyStore: createD1SigningKeyStore(env.DB) };
  }
  return (memoryDeps ??= { signingKeyStore: createMemorySigningKeyStore() });
}
