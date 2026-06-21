import { err } from "@microservices-sh/connection-contract";
import type { AuthContext } from "@microservices-sh/connection-contract";
import { knowledgeBaseRagMeta } from "../meta";

export function isoFrom(now?: () => number) {
  return new Date(now?.() ?? Date.now()).toISOString();
}

export function generatedId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().slice(0, 16)}`;
}

export function countWords(content: string) {
  return content.trim().split(/\s+/g).filter(Boolean).length;
}

export function requireScope(ctx: AuthContext | undefined, deps?: { correlationId?: string; now?: () => number }) {
  if (!ctx || typeof ctx.orgId !== "string" || ctx.orgId.length === 0) {
    return err(
      403,
      { code: "knowledge-base-rag.SCOPE_REQUIRED", message: "An authenticated org scope is required." },
      knowledgeBaseRagMeta(deps)
    );
  }
  return null;
}

export function tenantInput(ctx: AuthContext, input: unknown) {
  const base = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return { ...base, tenantId: ctx.orgId };
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
