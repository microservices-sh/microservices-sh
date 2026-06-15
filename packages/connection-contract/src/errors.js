// Central status-code map + per-module-namespaced error-code registry.
// See plans/25-module-connection-standard.md §4. Codes are namespaced as
// "<moduleId>.<NAME>"; every code must be registered before use.

export const STATUS = Object.freeze({
  validation: 400,
  auth: 401,
  scope: 403,
  notFound: 404,
  conflict: 409,
  upstream: 502,
  internal: 500,
});

export function statusFor(category) {
  const s = STATUS[category];
  if (!s) throw new Error(`Unknown error category: ${category}`);
  return s;
}

const registry = new Map(); // moduleId -> Set<name>

export function registerCodes(moduleId, names) {
  const set = registry.get(moduleId) ?? new Set();
  for (const n of names) {
    if (set.has(n)) throw new Error(`Duplicate error code ${moduleId}.${n}`);
    set.add(n);
  }
  registry.set(moduleId, set);
}

export function errorCode(moduleId, name) {
  if (!registry.get(moduleId)?.has(name)) {
    throw new Error(`Unregistered error code ${moduleId}.${name}`);
  }
  return `${moduleId}.${name}`;
}

// Test-only: clear the module-level registry between cases.
export function __resetRegistry() {
  registry.clear();
}
