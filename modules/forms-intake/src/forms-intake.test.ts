import { describe, it, expect } from "vitest";
import {
  validateSubmission,
  validateAttachment,
  createForm,
  submitForm,
  reviewSubmission,
  createMemoryFormStore,
  createMemoryTurnstileVerifier
} from "./index";
import type { FormField } from "./types";

const fixedNow = (ms: number) => () => ms;
const T0 = Date.parse("2026-01-01T00:00:00.000Z");

describe("forms-intake: pure submission validation", () => {
  const fields: FormField[] = [
    { id: "email", label: "Email", type: "email", required: true },
    { id: "isBusiness", label: "Are you a business?", type: "select", required: true, validation: { options: ["yes", "no"] } },
    // Only visible (and required) when isBusiness === "yes".
    { id: "company", label: "Company name", type: "text", required: true, visibleWhen: { field: "isBusiness", equals: "yes" } },
    { id: "age", label: "Age", type: "number", required: false, validation: { min: 18 } }
  ];

  it("does NOT require a field hidden by conditional logic", () => {
    const res = validateSubmission(fields, { email: "a@b.com", isBusiness: "no" });
    expect(res.ok).toBe(true);
    // The hidden 'company' value is dropped, not persisted.
    expect(res.activeValues).not.toHaveProperty("company");
    expect(res.activeValues.isBusiness).toBe("no");
  });

  it("DOES require a visible-required field when its condition is met", () => {
    const res = validateSubmission(fields, { email: "a@b.com", isBusiness: "yes" });
    expect(res.ok).toBe(false);
    expect(res.errors.map((e) => e.fieldId)).toContain("company");
    expect(res.errors.find((e) => e.fieldId === "company")?.code).toBe("REQUIRED");
  });

  it("rejects a missing visible-required field and a bad type", () => {
    const res = validateSubmission(fields, { isBusiness: "no", age: "not-a-number" });
    expect(res.ok).toBe(false);
    const byId = Object.fromEntries(res.errors.map((e) => [e.fieldId, e.code]));
    expect(byId.email).toBe("REQUIRED"); // missing visible-required
    expect(byId.age).toBe("TYPE"); // non-numeric value
  });

  it("rejects an invalid email format", () => {
    const res = validateSubmission(fields, { email: "nope", isBusiness: "no" });
    expect(res.ok).toBe(false);
    expect(res.errors.find((e) => e.fieldId === "email")?.code).toBe("RULE");
  });
});

describe("forms-intake: attachment validation", () => {
  const allowed = ["image/png", "application/pdf"];
  const maxBytes = 1_000;

  it("rejects a disallowed content-type", () => {
    const err = validateAttachment(
      { fieldId: "file", key: "k", contentType: "application/x-msdownload", bytes: 10, originalName: "x.exe" },
      allowed,
      maxBytes
    );
    expect(err).toMatch(/not allowed/);
  });

  it("rejects an oversize attachment", () => {
    const err = validateAttachment(
      { fieldId: "file", key: "k", contentType: "image/png", bytes: 2_000, originalName: "big.png" },
      allowed,
      maxBytes
    );
    expect(err).toMatch(/limit/);
  });

  it("accepts an allowed type within the size cap", () => {
    const err = validateAttachment(
      { fieldId: "file", key: "k", contentType: "image/png", bytes: 500, originalName: "ok.png" },
      allowed,
      maxBytes
    );
    expect(err).toBeNull();
  });
});

async function makeForm(formStore: ReturnType<typeof createMemoryFormStore>, over?: { requireTurnstile?: boolean }) {
  const created = await createForm(
    {
      tenantId: "tenant-1",
      name: "Contact",
      fields: [{ id: "email", label: "Email", type: "email", required: true }],
      requireTurnstile: over?.requireTurnstile ?? false
    },
    { formStore, now: fixedNow(T0) }
  );
  if (!created.ok) throw new Error("form creation failed");
  return created.data.id as string;
}

describe("forms-intake: submitForm idempotency", () => {
  it("dedups a retried submission on idempotencyKey", async () => {
    const formStore = createMemoryFormStore();
    const formId = await makeForm(formStore);

    const first = await submitForm(
      { formId, tenantId: "tenant-1", values: { email: "a@b.com" }, idempotencyKey: "key-1" },
      { formStore, now: fixedNow(T0) }
    );
    expect(first.status).toBe(201);
    expect(first.ok && first.data.deduped).toBe(false);

    const replay = await submitForm(
      { formId, tenantId: "tenant-1", values: { email: "a@b.com" }, idempotencyKey: "key-1" },
      { formStore, now: fixedNow(T0 + 1) }
    );
    expect(replay.status).toBe(200);
    expect(replay.ok && replay.data.deduped).toBe(true);

    const stored = await formStore.listSubmissions({ tenantId: "tenant-1", formId });
    expect(stored).toHaveLength(1);
  });
});

describe("forms-intake: attachment rejection at submit time", () => {
  it("rejects a disallowed attachment content-type with 415", async () => {
    const formStore = createMemoryFormStore();
    const formId = await makeForm(formStore);

    const res = await submitForm(
      {
        formId,
        tenantId: "tenant-1",
        values: { email: "a@b.com" },
        attachments: [{ fieldId: "f", key: "k", contentType: "application/x-msdownload", bytes: 10, originalName: "x.exe" }]
      },
      { formStore, now: fixedNow(T0) }
    );
    expect(res.ok).toBe(false);
    expect(res.status).toBe(415);
    if (!res.ok) expect(res.error.code).toBe("forms-intake.ATTACHMENT_REJECTED");
  });
});

describe("forms-intake: Turnstile gating", () => {
  it("passes with an always-pass verifier when required", async () => {
    const formStore = createMemoryFormStore();
    const formId = await makeForm(formStore, { requireTurnstile: true });

    const res = await submitForm(
      { formId, tenantId: "tenant-1", values: { email: "a@b.com" }, turnstileToken: "tok" },
      { formStore, turnstile: createMemoryTurnstileVerifier(true), now: fixedNow(T0) }
    );
    expect(res.ok).toBe(true);
    expect(res.status).toBe(201);
  });

  it("fails closed when required and the verifier rejects the token", async () => {
    const formStore = createMemoryFormStore();
    const formId = await makeForm(formStore, { requireTurnstile: true });

    const res = await submitForm(
      { formId, tenantId: "tenant-1", values: { email: "a@b.com" }, turnstileToken: "tok" },
      { formStore, turnstile: createMemoryTurnstileVerifier(false), now: fixedNow(T0) }
    );
    expect(res.ok).toBe(false);
    expect(res.status).toBe(403);
    if (!res.ok) expect(res.error.code).toBe("forms-intake.TURNSTILE_FAILED");
  });

  it("rejects a missing token when Turnstile is required", async () => {
    const formStore = createMemoryFormStore();
    const formId = await makeForm(formStore, { requireTurnstile: true });

    const res = await submitForm(
      { formId, tenantId: "tenant-1", values: { email: "a@b.com" } },
      { formStore, turnstile: createMemoryTurnstileVerifier(true), now: fixedNow(T0) }
    );
    expect(res.ok).toBe(false);
    expect(res.status).toBe(400);
    if (!res.ok) expect(res.error.code).toBe("forms-intake.TURNSTILE_REQUIRED");
  });
});

describe("forms-intake: submission review lifecycle", () => {
  async function submitOne(formStore: ReturnType<typeof createMemoryFormStore>) {
    const formId = await makeForm(formStore);
    const res = await submitForm(
      { formId, tenantId: "tenant-1", values: { email: "a@b.com" } },
      { formStore, now: fixedNow(T0) }
    );
    if (!res.ok) throw new Error("submit failed");
    return { formId, submissionId: res.data.id as string };
  }

  it("new submissions enter the queue as pending", async () => {
    const formStore = createMemoryFormStore();
    const { formId } = await submitOne(formStore);
    const [stored] = await formStore.listSubmissions({ tenantId: "tenant-1", formId });
    expect(stored.status).toBe("pending");
    expect(stored.reviewedAt).toBeNull();
    expect(stored.reviewedBy).toBeNull();
  });

  it("approves a pending submission and records reviewer metadata", async () => {
    const formStore = createMemoryFormStore();
    const { submissionId } = await submitOne(formStore);

    const res = await reviewSubmission(
      { submissionId, tenantId: "tenant-1", decision: "approved", reviewedBy: "admin-1" },
      { formStore, now: fixedNow(T0 + 1000) }
    );
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    if (res.ok) {
      expect(res.data.status).toBe("approved");
      expect(res.data.reviewedBy).toBe("admin-1");
      expect(res.data.event.name).toBe("forms-intake.submission_reviewed");
    }
  });

  it("rejects with a reviewer note", async () => {
    const formStore = createMemoryFormStore();
    const { submissionId } = await submitOne(formStore);

    const res = await reviewSubmission(
      { submissionId, tenantId: "tenant-1", decision: "rejected", reviewedBy: "admin-1", note: "spam" },
      { formStore, now: fixedNow(T0 + 1000) }
    );
    expect(res.ok && res.data.status).toBe("rejected");
    const got = await formStore.getSubmission(submissionId, "tenant-1");
    expect(got?.reviewNote).toBe("spam");
  });

  it("allows re-review after changes_requested but not after a terminal decision", async () => {
    const formStore = createMemoryFormStore();
    const { submissionId } = await submitOne(formStore);

    const first = await reviewSubmission(
      { submissionId, tenantId: "tenant-1", decision: "changes_requested", reviewedBy: "admin-1" },
      { formStore, now: fixedNow(T0 + 1) }
    );
    expect(first.ok && first.data.status).toBe("changes_requested");

    // changes_requested is re-reviewable.
    const second = await reviewSubmission(
      { submissionId, tenantId: "tenant-1", decision: "approved", reviewedBy: "admin-2" },
      { formStore, now: fixedNow(T0 + 2) }
    );
    expect(second.ok && second.data.status).toBe("approved");

    // approved is terminal — a third review is a 409 conflict.
    const third = await reviewSubmission(
      { submissionId, tenantId: "tenant-1", decision: "rejected", reviewedBy: "admin-3" },
      { formStore, now: fixedNow(T0 + 3) }
    );
    expect(third.ok).toBe(false);
    expect(third.status).toBe(409);
    if (!third.ok) expect(third.error.code).toBe("forms-intake.SUBMISSION_NOT_REVIEWABLE");
  });

  it("404s an unknown submission and isolates tenants", async () => {
    const formStore = createMemoryFormStore();
    const { submissionId } = await submitOne(formStore);

    const missing = await reviewSubmission(
      { submissionId: "sub_nope", tenantId: "tenant-1", decision: "approved", reviewedBy: "admin-1" },
      { formStore }
    );
    expect(missing.status).toBe(404);

    // Right id, wrong tenant — must not be reachable.
    const crossTenant = await reviewSubmission(
      { submissionId, tenantId: "tenant-2", decision: "approved", reviewedBy: "admin-1" },
      { formStore }
    );
    expect(crossTenant.status).toBe(404);
  });

  it("filters the review queue by status", async () => {
    const formStore = createMemoryFormStore();
    const { formId, submissionId } = await submitOne(formStore);
    // Add a second submission and approve only the first.
    const second = await submitForm(
      { formId, tenantId: "tenant-1", values: { email: "c@d.com" } },
      { formStore, now: fixedNow(T0 + 5) }
    );
    expect(second.ok).toBe(true);
    await reviewSubmission(
      { submissionId, tenantId: "tenant-1", decision: "approved", reviewedBy: "admin-1" },
      { formStore, now: fixedNow(T0 + 6) }
    );

    const pending = await formStore.listSubmissions({ tenantId: "tenant-1", formId, status: "pending" });
    expect(pending).toHaveLength(1);
    const approved = await formStore.listSubmissions({ tenantId: "tenant-1", formId, status: "approved" });
    expect(approved.map((s) => s.id)).toEqual([submissionId]);
  });
});
