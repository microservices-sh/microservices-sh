import type { IdentityUser, SessionRecord } from "./types";

// Customization seams (module.json hookPoints). Defaults are pass-through / no-op so
// the module behaves identically when a host wires no hooks.

// Filter (scope identity.extend): inspect/transform the verify input before the code
// is checked, e.g. normalize the email or reject blocked addresses. Return null to
// abort verification.
export async function beforeVerifyCode(
  input: { email: string; code: string }
): Promise<{ email: string; code: string } | null> {
  return input;
}

// Observer (scope identity.observe): react to a freshly created session, e.g. record
// a login audit entry or warm a cache. Side-effect only; cannot change the outcome.
export async function afterSessionCreated(
  _event: { user: IdentityUser; session: SessionRecord }
): Promise<void> {
  return;
}
