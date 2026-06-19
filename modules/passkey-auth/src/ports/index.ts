import type { ChallengeRecord, CredentialRecord } from "../types";

// Persistence port for the passkey module. Templates inject a D1-backed adapter in
// production and a memory adapter in tests/dev (same pattern as @microservices-sh/
// identity's stores). Both adapters implement the exact same interface.
export interface PasskeyStore {
  // — Challenges (short-lived) —
  // Upsert by challengeKey — a new ceremony replaces any outstanding challenge.
  putChallenge(record: ChallengeRecord): Promise<void>;
  getChallenge(challengeKey: string): Promise<ChallengeRecord | null>;
  deleteChallenge(challengeKey: string): Promise<void>;

  // — Credentials (long-lived) —
  saveCredential(record: CredentialRecord): Promise<void>;
  getCredentialsByUser(userId: string): Promise<CredentialRecord[]>;
  getCredentialById(credentialId: string): Promise<CredentialRecord | null>;
  // Bump the signature counter (and last-used) after a successful assertion.
  updateCounter(credentialId: string, counter: number, lastUsedAt: number): Promise<void>;
  // Delete scoped to the owning user; returns true if a row was removed.
  deleteCredential(credentialId: string, userId: string): Promise<boolean>;
}
