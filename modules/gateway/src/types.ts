export interface ApiKeyRecord {
  id: string;
  // SHA-256 hex of the raw key; the raw key is never stored.
  hash: string;
  workspace: string;
  project: string;
  // Principal the key acts as when exchanged for a token.
  subject: string;
  // Scopes this key may request. Issued tokens cannot exceed this grant.
  scopes: string[];
  status: "active" | "revoked";
  createdAt: string;
}

export interface Principal {
  subject: string;
  workspace: string;
  project: string;
  scopes: string[];
  apiKeyId: string;
}

export interface MintRequest {
  subject: string;
  scopes: string[];
  ttlSeconds: number;
  workspace: string;
  project: string;
}

export type MintOutcome =
  | { ok: true; token: string; claims: Record<string, unknown> }
  | { ok: false; status: number; error: unknown };

export interface DomainEvent {
  eventName: "gateway.token_issued" | "gateway.access_denied";
  entityType: "gateway";
  entityId: string;
  // Threaded from the use-case meta so emitted events stay correlatable across
  // the inbound exchange. See Plan 25 §4.
  correlationId: string;
  payload: Record<string, unknown>;
}
