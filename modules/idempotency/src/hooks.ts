import type { ClaimIdempotencyInput } from "./schemas";
import type { IdempotencyRecord } from "./types";

export interface IdempotencyHooks {
  beforeIdempotencyClaim?: (input: ClaimIdempotencyInput) => Promise<ClaimIdempotencyInput | null> | ClaimIdempotencyInput | null;
  afterIdempotencyComplete?: (record: IdempotencyRecord) => Promise<void> | void;
  afterIdempotencyFail?: (record: IdempotencyRecord) => Promise<void> | void;
  onIdempotencyReplay?: (record: IdempotencyRecord) => Promise<void> | void;
}

export const defaultIdempotencyHooks: Required<IdempotencyHooks> = {
  beforeIdempotencyClaim(input) {
    return input;
  },
  afterIdempotencyComplete() {
    return undefined;
  },
  afterIdempotencyFail() {
    return undefined;
  },
  onIdempotencyReplay() {
    return undefined;
  }
};

export async function beforeIdempotencyClaim(input: ClaimIdempotencyInput) {
  return defaultIdempotencyHooks.beforeIdempotencyClaim(input);
}

export async function afterIdempotencyComplete(record: IdempotencyRecord) {
  return defaultIdempotencyHooks.afterIdempotencyComplete(record);
}

export async function afterIdempotencyFail(record: IdempotencyRecord) {
  return defaultIdempotencyHooks.afterIdempotencyFail(record);
}

export async function onIdempotencyReplay(record: IdempotencyRecord) {
  return defaultIdempotencyHooks.onIdempotencyReplay(record);
}
