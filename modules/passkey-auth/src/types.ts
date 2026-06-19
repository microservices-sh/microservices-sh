// Domain types for the passkey (WebAuthn) module. These are storage-shaped (camelCase)
// and mirror the passkey_credentials / passkey_challenges migration.

// A short-lived WebAuthn challenge, keyed by "reg:<userId>" (registration) or
// "login:<uuid>" (authentication). Consumed single-use and expires after the TTL.
export interface ChallengeRecord {
  challengeKey: string;
  challenge: string;
  userId: string | null; // set for registration; null for authentication
  createdAt: number; // epoch ms
  expiresAt: number; // epoch ms
}

// A long-lived registered credential (public key + signature counter).
export interface CredentialRecord {
  id: string; // internal id, e.g. "pk_..."
  userId: string;
  credentialId: string; // base64url credential id
  publicKey: string; // base64url COSE public key
  counter: number; // signature counter (clone detection)
  name: string; // human label
  transports: string[]; // e.g. ["internal","hybrid"]
  deviceType: string | null; // singleDevice | multiDevice
  backedUp: boolean;
  createdAt: number; // epoch ms
  lastUsedAt: number | null; // epoch ms
}

// The projection returned to callers from listCredentials (no public key / counter).
// `credentialId` (the base64url WebAuthn id) is the handle used for deleteCredential.
export interface CredentialSummary {
  id: string;
  credentialId: string;
  name: string;
  createdAt: number;
  lastUsedAt: number | null;
}
