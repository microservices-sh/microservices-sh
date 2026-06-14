// Forms-intake domain types.
//
// A Form owns a serializable list of field definitions. Each field carries its
// own type + validation rules + optional conditional-visibility rule. The whole
// definition round-trips through JSON (D1 stores it as a TEXT column), so it must
// be plain data — no functions, no class instances. Validation of a submission is
// done by a PURE function (src/validate-submission.ts) that interprets this data;
// the failure agents hit is to special-case validation in route code where it
// drifts from the stored definition.

// Form lifecycle: draft (editable) -> published (frozen field set, accepts
// submissions) -> archived (no new submissions). Only drafts may have their
// fields edited — a published form's schema is immutable so historical
// submissions stay interpretable against the definition they were validated with.
export type FormStatus = "draft" | "published" | "archived";

export type FieldType = "text" | "email" | "number" | "checkbox" | "select";

// Per-field validation rules. All optional; absent means "no constraint".
// Kept as plain data so the rule set serializes and the pure validator can
// interpret it without any host wiring.
export interface FieldValidation {
  // text/email/select: string length bounds. number: ignored.
  minLength?: number;
  maxLength?: number;
  // number: numeric bounds (inclusive).
  min?: number;
  max?: number;
  // text/email: anchored regex source the value must fully match.
  pattern?: string;
  // select: the allowed option values. A submitted value outside this set fails.
  options?: string[];
}

// Conditional visibility: this field is only shown (and only validated/required)
// when another field's submitted value satisfies the condition. This is the
// subtle correctness point — a required-but-HIDDEN field must NOT be reported as
// missing, which naive validators get wrong by checking `required` unconditionally.
export interface FieldCondition {
  // The id of the field this one depends on.
  field: string;
  // Equality test against the controlling field's submitted value (string-compared).
  equals: string;
}

export interface FormField {
  // Stable key used as the submission value key. Unique within a form.
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  validation?: FieldValidation;
  // When present, the field is only active if the condition is met.
  visibleWhen?: FieldCondition;
}

export interface Form {
  id: string;
  tenantId: string;
  name: string;
  status: FormStatus;
  // The serializable field set. Stored as JSON in D1.
  fields: FormField[];
  // When true, submissions must pass a Turnstile token check (spam protection).
  requireTurnstile: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

// A reference to an uploaded attachment. The module stores references only, never
// bytes — bytes live in file-media/R2. Content-type + size are validated against
// the configured allowlist/cap before a reference is accepted.
export interface AttachmentRef {
  fieldId: string;
  // Storage key (e.g. file-media object key). Opaque to this module.
  key: string;
  contentType: string;
  bytes: number;
  originalName: string;
}

export interface FormSubmission {
  id: string;
  formId: string;
  tenantId: string;
  // Field id -> submitted value (string | number | boolean), only for active fields.
  values: Record<string, string | number | boolean>;
  attachments: AttachmentRef[];
  // Optional client-supplied dedup key; null when not provided.
  idempotencyKey: string | null;
  submittedAt: string;
}

export interface FormFilter {
  tenantId: string;
  status?: FormStatus;
  limit?: number;
}

export interface SubmissionFilter {
  tenantId: string;
  formId: string;
  limit?: number;
}

// Result of the pure submission validator.
export interface SubmissionValidationError {
  fieldId: string;
  code: string;
  message: string;
}

export interface SubmissionValidationResult {
  ok: boolean;
  errors: SubmissionValidationError[];
  // Values narrowed to the fields that were actually active (visible). Hidden
  // fields are dropped so they are never persisted or treated as required.
  activeValues: Record<string, string | number | boolean>;
}
