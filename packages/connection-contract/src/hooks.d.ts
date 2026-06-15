import type { Err } from "./envelope";

export type HookKind = "filter" | "guard" | "observer";

export interface HookCtx {
  correlationId: string;
  [key: string]: unknown;
}

export type GuardVerdict = { ok: true } | { ok: false; status?: number; error: Err };

export interface ResolvedHook<T = unknown> {
  kind: HookKind;
  order: number;
  fn: (value: T, ctx: HookCtx) => Promise<T | GuardVerdict | void>;
}

export type HookResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; error: Err };

export function runHooks<T>(
  point: string,
  input: T,
  ctx: HookCtx,
  chain: ResolvedHook<T>[]
): Promise<HookResult<T>>;
