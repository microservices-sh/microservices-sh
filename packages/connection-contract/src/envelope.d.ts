export interface Meta {
  requestId: string;
  correlationId: string;
  source: string;
  ts: string;
}

export interface Err {
  code: string;
  message: string;
  remediation?: string;
  issues?: unknown[];
  cause?: string;
}

export type Result<T> =
  | { ok: true; status: number; data: T; meta: Meta }
  | { ok: false; status: number; error: Err; meta: Meta };

export function ok<T>(status: number, data: T, meta: Meta): Extract<Result<T>, { ok: true }>;
export function err(status: number, error: Err, meta: Meta): Extract<Result<never>, { ok: false }>;
export function isOk<T>(r: Result<T>): r is Extract<Result<T>, { ok: true }>;
export function isErr<T>(r: Result<T>): r is Extract<Result<T>, { ok: false }>;
