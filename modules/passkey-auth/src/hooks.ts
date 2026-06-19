import type { RegistrationResponseJSON } from "@simplewebauthn/types";

// Customization seams (module.json hookPoints). Defaults are pass-through / no-op so
// the module behaves identically when a host wires no hooks.

// Filter (scope passkey.register): inspect/transform the verify-registration input
// before attestation is checked, e.g. enforce a per-user passkey cap. Return null to
// abort registration.
export async function beforeVerifyRegistration(
  input: { userId: string; response: RegistrationResponseJSON }
): Promise<{ userId: string; response: RegistrationResponseJSON } | null> {
  return input;
}

// Observer (scope passkey.authenticate): react to a successful authentication, e.g.
// record a login audit entry. Side-effect only; cannot change the outcome.
export async function afterAuthenticated(
  _event: { userId: string; credentialId: string }
): Promise<void> {
  return;
}
