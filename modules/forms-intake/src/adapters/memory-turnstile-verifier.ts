import type { TurnstileVerifier } from "../ports";

// Test/local verifier with no I/O. Defaults to always-pass so tests can inject it
// without hitting the network; pass `false` to simulate a failing spam check.
export function createMemoryTurnstileVerifier(pass = true): TurnstileVerifier {
  return {
    async verify() {
      return pass;
    }
  };
}
