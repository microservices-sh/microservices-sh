// Optional event sink injected by the host. The module emits domain events
// (passkey.registered / passkey.authenticated / passkey.credential_deleted) through
// this seam so wiring to audit-log / an event bus stays the host's choice.
export type PasskeyEventName =
  | "passkey.registered"
  | "passkey.authenticated"
  | "passkey.credential_deleted";

export type EmitFn = (name: PasskeyEventName, payload: Record<string, unknown>) => void;
