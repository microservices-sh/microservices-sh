import type { ApiKeyRecord, DomainEvent, MintOutcome, MintRequest } from "../types";

export interface ApiKeyStore {
  getByHash(hash: string): Promise<ApiKeyRecord | null>;
  putApiKey(record: ApiKeyRecord): Promise<void>;
  revokeApiKey(id: string): Promise<void>;
  writeEvent(event: DomainEvent): Promise<void>;
}

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  resetAt: string;
}

export interface RateLimitStore {
  // Fixed-window counter for an identifier; returns whether the hit is allowed.
  hit(identifier: string, limit: number, windowSeconds: number): Promise<RateLimitResult>;
}

// Abstracts token minting so the gateway never signs. Backed by the auth module
// in-process (embedded) or by the auth service binding (service mode).
export interface TokenMinter {
  mint(request: MintRequest): Promise<MintOutcome>;
}
