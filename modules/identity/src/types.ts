// The authenticated principal exposed to templates (set on locals.user) and consumed
// by the token bridge. `isAdmin` gates the SSR /admin layout guard.
export interface IdentityUser {
  id: string;
  email: string;
  isAdmin: boolean;
  role?: string;
}

export interface Account {
  id: string;
  email: string;
  isAdmin: boolean;
  createdAt: string;
}

// One active login code per email (upserted on each request). The plaintext code is
// NEVER stored — only a salted SHA-256 hash.
export interface LoginCodeRecord {
  email: string;
  codeHash: string;
  expiresAt: number; // epoch ms
  attempts: number;
  consumedAt: number | null;
}

export interface SessionRecord {
  id: string;
  userId: string;
  expiresAt: number; // epoch ms
  createdAt: number;
}
