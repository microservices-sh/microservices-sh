// Identity emits login + session lifecycle events; consumes none.
export const events = {
  emitted: [
    "identity.login_code_issued",
    "identity.login_verified",
    "identity.session_created",
    "identity.session_destroyed",
  ],
  consumed: [],
} as const;
