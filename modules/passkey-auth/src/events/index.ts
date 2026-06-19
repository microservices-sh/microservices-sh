// Passkey-auth emits credential + authentication lifecycle events; consumes none.
export const events = {
  emitted: [
    "passkey.registered",
    "passkey.authenticated",
    "passkey.credential_deleted",
  ],
  consumed: [],
} as const;
