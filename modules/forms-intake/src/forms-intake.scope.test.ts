import { describe, it, expect } from "vitest";
import { authContext } from "@microservices-sh/connection-contract";
import type { AuthContext } from "@microservices-sh/connection-contract";
import {
  createForm,
  submitForm,
  createMemoryFormStore,
  listFormsScoped,
  getFormScoped,
  updateFormScoped,
  listSubmissionsScoped,
  reviewSubmissionScoped
} from "./index";

// plans/33 — the enforced authorization boundary, proven for the forms-intake
// OPERATOR surface. Two tenants share one store; an operator scoped to org A must
// never list, read, edit, or moderate org B's forms/submissions. (submitForm is
// the public end-user endpoint and is intentionally not scoped here.)
const fixedNow = (ms: number) => () => ms;
const T0 = Date.parse("2026-01-01T00:00:00.000Z");

async function seedForm(formStore: ReturnType<typeof createMemoryFormStore>, tenantId: string) {
  const created = await createForm({ tenantId, name: "Contact" }, { formStore, now: fixedNow(T0) });
  if (!created.ok) throw new Error("seed form failed");
  return (created.data as { id: string }).id;
}

describe("forms-intake: enforced tenant boundary (cross-tenant leak test)", () => {
  it("an operator scoped to org A can never list, read, edit, or moderate org B's intake", async () => {
    const formStore = createMemoryFormStore();
    const deps = { formStore, now: fixedNow(T0) };
    const ctxA = authContext({ orgId: "tenant-1", actorId: "op-a" });
    const ctxB = authContext({ orgId: "tenant-2", actorId: "op-b" });

    await seedForm(formStore, "tenant-1");
    const formB = await seedForm(formStore, "tenant-2");

    // A public submission lands on B's form (draft forms accept submissions).
    const sub = await submitForm({ formId: formB, tenantId: "tenant-2", values: {} }, deps);
    if (!sub.ok) throw new Error("seed submission failed");
    const subB = (sub.data as { id: string }).id;

    // LIST forms as A returns only A's — even with a forged tenantId on the input.
    const listed = await listFormsScoped(ctxA, { tenantId: "tenant-2" }, deps);
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.data.count).toBe(1);
      expect(listed.data.forms.every((f) => f.tenantId === "tenant-1")).toBe(true);
    }

    // GET / UPDATE B's form as A → not-found (no existence disclosure, no edit).
    const foreignGet = await getFormScoped(ctxA, { formId: formB }, deps);
    expect(foreignGet.ok).toBe(false);
    expect(foreignGet.status).toBe(404);
    const foreignEdit = await updateFormScoped(ctxA, { formId: formB, name: "hacked" }, deps);
    expect(foreignEdit.ok).toBe(false);
    expect(foreignEdit.status).toBe(404);

    // LIST B's submissions as A (forged formId) → zero rows.
    const foreignSubs = await listSubmissionsScoped(ctxA, { formId: formB }, deps);
    expect(foreignSubs.ok).toBe(true);
    if (foreignSubs.ok) expect(foreignSubs.data.count).toBe(0);

    // MODERATE B's submission as A → not-found; B's submission stays pending.
    const foreignReview = await reviewSubmissionScoped(
      ctxA,
      { submissionId: subB, decision: "rejected", reviewedBy: "op-a" },
      deps
    );
    expect(foreignReview.ok).toBe(false);
    expect(foreignReview.status).toBe(404);
    const bSubs = await listSubmissionsScoped(ctxB, { formId: formB }, deps);
    expect(bSubs.ok).toBe(true);
    if (bSubs.ok) {
      expect(bSubs.data.count).toBe(1);
      expect(bSubs.data.submissions[0].status).toBe("pending");
    }

    // A call lacking an org scope is refused (403).
    const noScope = await listFormsScoped(
      { orgId: "", actorId: "x", roles: [] } as unknown as AuthContext,
      {},
      deps
    );
    expect(noScope.ok).toBe(false);
    expect(noScope.status).toBe(403);
  });
});
