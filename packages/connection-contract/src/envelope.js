// Unified Result envelope shared by every connection primitive (RPC, events, hooks)
// and the HTTP/API layer. See plans/25-module-connection-standard.md §4.

export function ok(status, data, meta) {
  return { ok: true, status, data, meta };
}

export function err(status, error, meta) {
  if (!error || typeof error.code !== "string" || typeof error.message !== "string") {
    throw new Error("err() requires error.code and error.message strings");
  }
  return { ok: false, status, error, meta };
}

export const isOk = (r) => r.ok === true;
export const isErr = (r) => r.ok === false;
