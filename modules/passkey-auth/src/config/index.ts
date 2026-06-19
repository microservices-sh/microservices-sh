// Tunables for the passkey (WebAuthn) ceremonies. Conservative defaults; override per
// use-case call via deps.
export const CHALLENGE_TTL_SECONDS = 300; // 5 minutes — short-lived WebAuthn challenge
