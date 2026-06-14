import type { DomainEvent, PublicSigningKey, SigningKey } from "../types";

export interface SigningKeyStore {
  // Current key used to sign new tokens.
  getActiveKey(): Promise<SigningKey | null>;
  // Lookup by kid for verification (active or recently retired).
  getKey(kid: string): Promise<SigningKey | null>;
  // Public keys to publish via JWKS (active + retired-but-still-verifiable).
  // Returns public-only material — never the private JWK.
  listPublicKeys(): Promise<PublicSigningKey[]>;
  // Mark all currently active keys retired before promoting a new one.
  retireActiveKeys(retiredAt: string): Promise<void>;
  putKey(key: SigningKey): Promise<void>;
  writeEvent(event: DomainEvent): Promise<void>;
}
