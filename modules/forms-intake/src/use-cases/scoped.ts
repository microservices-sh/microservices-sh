import { err } from "@microservices-sh/connection-contract";
import type { AuthContext } from "@microservices-sh/connection-contract";
import { formsIntakeMeta } from "../meta";
import { createForm } from "./create-form";
import { getForm } from "./get-form";
import { updateForm } from "./update-form";
import { listForms } from "./list-forms";
import { listSubmissions } from "./list-submissions";
import { reviewSubmission } from "./review-submission";

// Enforced-authorization wrappers (plans/33, L1) for the OPERATOR surface. The
// tenant comes from the server-resolved AuthContext, never from caller input:
// every wrapper forces the request's tenantId to ctx.orgId, so a forged tenantId
// can neither enumerate nor reach another tenant's forms/submissions (the store's
// existing tenant-scoped reads then enforce it). The public submitForm endpoint
// is intentionally NOT wrapped — form fillers are unauthenticated end-users, and
// the form's own tenant is resolved from its public id. Additive strangler — the
// wrapped use-cases are unchanged. See the leak test in forms-intake.scope.test.ts.

function requireScope(ctx: AuthContext | undefined, deps: { correlationId?: string; now?: () => number }) {
  if (!ctx || typeof ctx.orgId !== "string" || ctx.orgId.length === 0) {
    return err(
      403,
      { code: "forms-intake.SCOPE_REQUIRED", message: "An authenticated org scope is required." },
      formsIntakeMeta(deps)
    );
  }
  return null;
}

function withTenant(input: unknown, orgId: string) {
  const base = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return { ...base, tenantId: orgId };
}

export async function createFormScoped(ctx: AuthContext, input: unknown, deps: Parameters<typeof createForm>[1]) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  return createForm(withTenant(input, ctx.orgId), deps);
}

export async function getFormScoped(ctx: AuthContext, input: unknown, deps: Parameters<typeof getForm>[1]) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  return getForm(withTenant(input, ctx.orgId), deps);
}

export async function updateFormScoped(ctx: AuthContext, input: unknown, deps: Parameters<typeof updateForm>[1]) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  return updateForm(withTenant(input, ctx.orgId), deps);
}

export async function listFormsScoped(ctx: AuthContext, input: unknown, deps: Parameters<typeof listForms>[1]) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  return listForms(withTenant(input, ctx.orgId), deps);
}

export async function listSubmissionsScoped(ctx: AuthContext, input: unknown, deps: Parameters<typeof listSubmissions>[1]) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  return listSubmissions(withTenant(input, ctx.orgId), deps);
}

export async function reviewSubmissionScoped(ctx: AuthContext, input: unknown, deps: Parameters<typeof reviewSubmission>[1]) {
  const denied = requireScope(ctx, deps);
  if (denied) return denied;
  return reviewSubmission(withTenant(input, ctx.orgId), deps);
}
