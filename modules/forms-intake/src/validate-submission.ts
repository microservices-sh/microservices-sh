import type {
  AttachmentRef,
  FormField,
  SubmissionValidationError,
  SubmissionValidationResult
} from "./types";

// PURE submission validator — no I/O, no fetch, no clock. Given a form's field
// definitions and a raw submission, decide whether the submission is valid and
// return the active (visible) values. Referenced by microservices.check.mjs.
//
// Encapsulated failure modes (the value of this function — do NOT remove):
//
// 1. CONDITIONAL VISIBILITY: a field with `visibleWhen` is only active when its
//    controlling field's submitted value equals the expected value. A
//    required-but-HIDDEN field must NOT be reported as missing. Naive validators
//    check `field.required` unconditionally and wrongly reject valid submissions
//    (e.g. requiring "company name" when "are you a business? = no"). We compute
//    visibility first, then only validate/require active fields.
//
// 2. TYPE COERCION: values arriving from JSON/form bodies may be strings
//    ("42", "true"). We coerce per field type and reject values that don't fit
//    the declared type — rather than silently storing "42" where a number is
//    expected, or treating "false" as truthy.
//
// 3. EMPTY != ABSENT: an empty string for an optional field is treated as "not
//    provided" (skipped), so optional fields don't fail length/pattern rules on
//    blank input. A required field that is absent OR empty fails.
//
// Visibility is evaluated against the RAW submitted values (a field can be
// controlled by another field regardless of that controller's own validity), but
// only the controlling field's presence/value matters for the equality test.

function isActive(field: FormField, rawValues: Record<string, unknown>): boolean {
  if (!field.visibleWhen) return true;
  const controllingValue = rawValues[field.visibleWhen.field];
  // String-compare so "yes" matches whether it arrived as string or coerced.
  return controllingValue !== undefined && String(controllingValue) === field.visibleWhen.equals;
}

// Coerce a raw value to the field's declared type. Returns { value } on success
// or { error } describing why it doesn't fit the type.
function coerce(
  field: FormField,
  raw: unknown
): { value: string | number | boolean } | { error: string } {
  switch (field.type) {
    case "text":
    case "email":
    case "select":
      if (typeof raw === "string") return { value: raw };
      if (typeof raw === "number" || typeof raw === "boolean") return { value: String(raw) };
      return { error: "Expected a string value." };
    case "number": {
      if (typeof raw === "number" && Number.isFinite(raw)) return { value: raw };
      if (typeof raw === "string" && raw.trim() !== "" && Number.isFinite(Number(raw))) {
        return { value: Number(raw) };
      }
      return { error: "Expected a numeric value." };
    }
    case "checkbox": {
      if (typeof raw === "boolean") return { value: raw };
      if (raw === "true") return { value: true };
      if (raw === "false") return { value: false };
      return { error: "Expected a boolean value." };
    }
    default:
      return { error: "Unknown field type." };
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function applyRules(field: FormField, value: string | number | boolean): string | null {
  const rules = field.validation;
  if (field.type === "email" && typeof value === "string" && !EMAIL_RE.test(value)) {
    return "Value is not a valid email address.";
  }
  if (!rules) return null;

  if (typeof value === "string") {
    if (rules.minLength !== undefined && value.length < rules.minLength) {
      return `Must be at least ${rules.minLength} characters.`;
    }
    if (rules.maxLength !== undefined && value.length > rules.maxLength) {
      return `Must be at most ${rules.maxLength} characters.`;
    }
    if (rules.pattern !== undefined) {
      // Anchored full-match so a partial match cannot pass.
      const re = new RegExp(`^(?:${rules.pattern})$`);
      if (!re.test(value)) return "Value does not match the required format.";
    }
    if (field.type === "select" && rules.options && !rules.options.includes(value)) {
      return "Value is not one of the allowed options.";
    }
  }

  if (typeof value === "number") {
    if (rules.min !== undefined && value < rules.min) return `Must be at least ${rules.min}.`;
    if (rules.max !== undefined && value > rules.max) return `Must be at most ${rules.max}.`;
  }

  return null;
}

function isEmpty(raw: unknown): boolean {
  return raw === undefined || raw === null || raw === "";
}

export function validateSubmission(
  fields: FormField[],
  rawValues: Record<string, unknown>
): SubmissionValidationResult {
  const errors: SubmissionValidationError[] = [];
  const activeValues: Record<string, string | number | boolean> = {};

  for (const field of fields) {
    // Inactive (hidden) fields are never required and never validated, and their
    // values are dropped from the persisted submission.
    if (!isActive(field, rawValues)) continue;

    const raw = rawValues[field.id];

    if (isEmpty(raw)) {
      // checkbox: absent means "false"; only required-true checkboxes can fail.
      if (field.type === "checkbox") {
        if (field.required && raw !== false) {
          errors.push({ fieldId: field.id, code: "REQUIRED", message: "This box must be checked." });
        } else {
          activeValues[field.id] = false;
        }
        continue;
      }
      if (field.required) {
        errors.push({ fieldId: field.id, code: "REQUIRED", message: "This field is required." });
      }
      continue;
    }

    const coerced = coerce(field, raw);
    if ("error" in coerced) {
      errors.push({ fieldId: field.id, code: "TYPE", message: coerced.error });
      continue;
    }

    const ruleError = applyRules(field, coerced.value);
    if (ruleError) {
      errors.push({ fieldId: field.id, code: "RULE", message: ruleError });
      continue;
    }

    activeValues[field.id] = coerced.value;
  }

  return { ok: errors.length === 0, errors, activeValues };
}

// PURE attachment-reference validation (mirrors file-media): a reference is
// accepted only if its content-type is on the allowlist and its byte size is at
// or under the cap. Bytes are never inspected here — references only.
export function validateAttachment(
  attachment: AttachmentRef,
  allowedContentTypes: string[],
  maxBytes: number
): string | null {
  if (!allowedContentTypes.includes(attachment.contentType)) {
    return `Content type ${attachment.contentType} is not allowed.`;
  }
  if (attachment.bytes > maxBytes) {
    return `Attachment exceeds the ${maxBytes}-byte limit.`;
  }
  return null;
}
