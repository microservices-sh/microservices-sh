import type { ModuleResult } from "../types";

export function ok<T>(status: number, data: T, warnings?: string[]): ModuleResult<T> {
  return { ok: true, status, data, ...(warnings?.length ? { warnings } : {}) };
}

export function fail(code: string, message: string, status = 400, details?: unknown): ModuleResult<never> {
  return { ok: false, status, error: { code, message, ...(details === undefined ? {} : { details }) } };
}

export function nowIso() {
  return new Date().toISOString();
}

export function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function averageConfidence(items: Array<{ confidence: number }>) {
  if (!items.length) return 0;
  return items.reduce((sum, item) => sum + item.confidence, 0) / items.length;
}
