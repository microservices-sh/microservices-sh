export interface Actor {
  id: string;
  email?: string;
  isAdmin?: boolean;
}

// Claims carried by every inter-service token. Verified by callee services
// against their own declared permissions before executing.
export interface TokenClaims {
  sub: string;
  workspace: string;
  project: string;
  scopes: string[];
  iss: string;
  iat: number;
  exp: number;
  jti: string;
}

export interface SigningKey {
  kid: string;
  algorithm: "EdDSA";
  publicJwk: JsonWebKey;
  // Prototype stores the private JWK in D1. Production must wrap this with a
  // secret/KMS binding so it never sits in plaintext (see migration comment).
  privateJwk: JsonWebKey;
  status: "active" | "retired";
  createdAt: string;
  retiredAt: string | null;
}

// Public-only view of a signing key. NEVER includes the private JWK. JWKS
// publishing and key listing return this so the private key cannot leak.
export type PublicSigningKey = Omit<SigningKey, "privateJwk">;

export interface DomainEvent {
  eventName: "auth.token_minted" | "auth.key_rotated";
  entityType: "auth";
  entityId: string;
  correlationId?: string | null;
  payload: Record<string, unknown>;
}
