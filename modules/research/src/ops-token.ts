// Per-tenant ops-access token for the operations read-back (Plan 32, P1).
//
// The codec is the SINGLE SOURCE OF TRUTH in `@microservices-sh/ops-token`,
// shared with the control-plane minter so mint and verify can never drift. This
// re-export keeps research's public surface (`@microservices-sh/research/ops-token`)
// stable; `createOpsTokenVerifier` returns the structural `OpsTokenVerifier` that
// `handleOpsRequest` consumes.
export { mintOpsToken, createOpsTokenVerifier, type OpsTokenClaims } from "@microservices-sh/ops-token";
