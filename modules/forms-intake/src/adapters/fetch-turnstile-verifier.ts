import type { TurnstileVerifier } from "../ports";

// Real Cloudflare Turnstile verifier. THIS is the only place fetch is called —
// the use case stays pure and just asks the port "is this token valid?". The
// secret never leaves the adapter. A network/HTTP failure is treated as a failed
// verification (fail-closed) rather than throwing into the use case.
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function createFetchTurnstileVerifier(secretKey: string): TurnstileVerifier {
  return {
    async verify(token, ip) {
      const body = new URLSearchParams();
      body.set("secret", secretKey);
      body.set("response", token);
      if (ip) body.set("remoteip", ip);

      try {
        const response = await fetch(TURNSTILE_VERIFY_URL, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body
        });
        if (!response.ok) return false;
        const result = (await response.json()) as { success?: boolean };
        return result.success === true;
      } catch {
        // Fail closed: a verification we cannot complete is not a pass.
        return false;
      }
    }
  };
}
