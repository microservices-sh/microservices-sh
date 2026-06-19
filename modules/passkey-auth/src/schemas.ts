// Lightweight, dependency-free input descriptors for the passkey surface. The
// use-cases themselves accept their typed inputs and normalize/validate defensively
// (so the module stays framework- and dependency-light, no zod). These descriptors
// document the contract for callers/route adapters that prefer to validate at the edge.

export interface FieldSpec {
  type: "string" | "object" | "array";
  required: boolean;
}

export const beginRegistrationInputSpec: Record<string, FieldSpec> = {
  user: { type: "object", required: true },
  rpId: { type: "string", required: true },
  rpName: { type: "string", required: true },
  origins: { type: "array", required: false },
};

export const verifyRegistrationInputSpec: Record<string, FieldSpec> = {
  userId: { type: "string", required: true },
  response: { type: "object", required: true },
  rpId: { type: "string", required: true },
  origins: { type: "array", required: true },
  name: { type: "string", required: false },
};

export const beginAuthenticationInputSpec: Record<string, FieldSpec> = {
  rpId: { type: "string", required: true },
  origins: { type: "array", required: false },
  identifier: { type: "string", required: false },
};

export const verifyAuthenticationInputSpec: Record<string, FieldSpec> = {
  response: { type: "object", required: true },
  challengeKey: { type: "string", required: true },
  rpId: { type: "string", required: true },
  origins: { type: "array", required: true },
};

export const listCredentialsInputSpec: Record<string, FieldSpec> = {
  userId: { type: "string", required: true },
};

export const deleteCredentialInputSpec: Record<string, FieldSpec> = {
  userId: { type: "string", required: true },
  credentialId: { type: "string", required: true },
};
