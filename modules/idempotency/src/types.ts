export interface IdempotencyConfig {
  enabled: boolean;
  defaultTtlMs: number;
  defaultLockTtlMs: number;
  maxTtlMs: number;
}

export type IdempotencyStatus = "in_progress" | "completed" | "failed";

export interface IdempotencyRecord {
  id: string;
  scope: string;
  key: string;
  requestHash: string | null;
  status: IdempotencyStatus;
  response: Record<string, unknown> | null;
  error: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  statusCode: number | null;
  lockedUntil: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface IdempotencyListFilter {
  scope?: string;
  status?: IdempotencyStatus;
  expiredBefore?: string;
  limit?: number;
}

export type IdempotencyEventName =
  | "idempotency.claimed"
  | "idempotency.replayed"
  | "idempotency.completed"
  | "idempotency.failed"
  | "idempotency.expired_pruned";

export interface DomainEvent {
  name: IdempotencyEventName;
  correlationId: string;
  payload: Record<string, unknown>;
}

export type ClaimAction = "claimed" | "replayed" | "in_progress";

export interface ClaimIdempotencyResult {
  action: ClaimAction;
  record: IdempotencyRecord;
  replayed: boolean;
  retryAfterMs?: number;
  event?: DomainEvent;
}

export interface CompleteIdempotencyResult {
  record: IdempotencyRecord;
  alreadyCompleted: boolean;
  event?: DomainEvent;
}

export interface FailIdempotencyResult {
  record: IdempotencyRecord;
  alreadyFailed: boolean;
  event?: DomainEvent;
}
