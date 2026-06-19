import type { PasskeyStore } from "../ports";
import type { ChallengeRecord, CredentialRecord } from "../types";

// In-memory PasskeyStore for tests + local dev without D1. Returns copies so callers
// can't mutate stored state. The D1 adapter (d1-passkey-store.ts) mirrors these
// semantics against the passkey_credentials / passkey_challenges migration.
export function createMemoryPasskeyStore(): PasskeyStore {
  const challenges = new Map<string, ChallengeRecord>();
  const credentials = new Map<string, CredentialRecord>(); // keyed by credentialId

  return {
    async putChallenge(record) {
      challenges.set(record.challengeKey, { ...record });
    },
    async getChallenge(challengeKey) {
      const c = challenges.get(challengeKey);
      return c ? { ...c } : null;
    },
    async deleteChallenge(challengeKey) {
      challenges.delete(challengeKey);
    },

    async saveCredential(record) {
      credentials.set(record.credentialId, { ...record, transports: [...record.transports] });
    },
    async getCredentialsByUser(userId) {
      return [...credentials.values()]
        .filter((c) => c.userId === userId)
        .map((c) => ({ ...c, transports: [...c.transports] }));
    },
    async getCredentialById(credentialId) {
      const c = credentials.get(credentialId);
      return c ? { ...c, transports: [...c.transports] } : null;
    },
    async updateCounter(credentialId, counter, lastUsedAt) {
      const c = credentials.get(credentialId);
      if (c) credentials.set(credentialId, { ...c, counter, lastUsedAt });
    },
    async deleteCredential(credentialId, userId) {
      const c = credentials.get(credentialId);
      if (!c || c.userId !== userId) return false;
      credentials.delete(credentialId);
      return true;
    },
  };
}
