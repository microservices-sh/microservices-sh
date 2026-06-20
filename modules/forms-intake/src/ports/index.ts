import type { Form, FormFilter, FormSubmission, SubmissionFilter } from "../types";

export interface FormStore {
  // Forms CRUD (tenant-scoped reads enforced by passing tenantId in filters/keys).
  insertForm(form: Form): Promise<void>;
  getForm(id: string, tenantId: string): Promise<Form | null>;
  updateForm(form: Form): Promise<void>;
  listForms(filter: FormFilter): Promise<Form[]>;

  // Submissions.
  insertSubmission(submission: FormSubmission): Promise<void>;
  // Tenant-scoped single read; used by the review use case to load before moderating.
  getSubmission(id: string, tenantId: string): Promise<FormSubmission | null>;
  // Persist a moderation transition (status + review metadata) for one submission.
  updateSubmission(submission: FormSubmission): Promise<void>;
  // Tenant + form scoped listing.
  listSubmissions(filter: SubmissionFilter): Promise<FormSubmission[]>;

  // Idempotency ledger for submissions: returns false if (formId, key) was already
  // recorded, so a retried POST is stored exactly once. This is the guard agents
  // omit, which double-stores submissions on a flaky network retry.
  recordSubmissionKey(formId: string, key: string): Promise<boolean>;
}

// Spam protection via Cloudflare Turnstile, behind an injected port so the use
// case never performs I/O. The adapter does the fetch; the use case just asks
// "is this token valid?". Optional/configurable: when a form does not require
// Turnstile (or no verifier is injected), the check is skipped.
export interface TurnstileVerifier {
  // Returns true when the token is valid. ip is optional (remoteip param).
  verify(token: string, ip?: string): Promise<boolean>;
}
