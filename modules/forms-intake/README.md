# Forms & Intake Module

Status: `available` (v0.1.0) · Class: `vertical` · Risk: `medium`

Dynamic forms + intake for Cloudflare Workers + D1. A form owns a **serializable**
field set (types + validation rules + conditional visibility), and submissions are
validated against that stored definition by a **pure** function. It encapsulates
the intake bugs AI agents reliably ship:

1. **Conditional visibility done right** — a field with `visibleWhen` is only
   active when its controlling field matches. A required-but-**hidden** field is
   **not** reported as missing. Naive validators check `required` unconditionally
   and wrongly reject valid submissions (e.g. requiring "company name" when
   "are you a business? = no"). Validation lives in one pure function
   (`src/validate-submission.ts`) driven by the stored schema — no drifting copy
   in route code.
2. **Idempotent submissions** — an optional `idempotencyKey` dedups duplicate
   submissions on a network retry, so a retried POST is stored exactly once.
3. **Spam protection via Turnstile** — verification runs through an injected
   `TurnstileVerifier` port; the use case never calls `fetch` (the adapter does).
   Optional/configurable per form.
4. **Validated attachment references** — content-type allowlist + size cap
   (mirrors file-media). References are stored, never bytes.

## Flow

```ts
import {
  createForm, getForm, updateForm, submitForm, listSubmissions,
  createD1FormStore, createFetchTurnstileVerifier
} from "@microservices-sh/forms-intake";

const formStore = createD1FormStore(env.DB);
const turnstile = createFetchTurnstileVerifier(env.TURNSTILE_SECRET);

const form = await createForm(
  {
    tenantId,
    name: "Contact",
    requireTurnstile: true,
    fields: [
      { id: "is_business", label: "Are you a business?", type: "select", required: true, validation: { options: ["yes", "no"] } },
      { id: "company", label: "Company name", type: "text", required: true, visibleWhen: { field: "is_business", equals: "yes" } },
      { id: "email", label: "Email", type: "email", required: true }
    ]
  },
  { formStore }
);

// "company" is hidden (is_business = no) so it is NOT required:
await submitForm(
  { formId: form.data.id, tenantId, values: { is_business: "no", email: "a@b.com" }, idempotencyKey, turnstileToken },
  { formStore, turnstile }
);
```

## Validation

`validateSubmission(fields, rawValues)` is pure (no I/O): it evaluates visibility,
coerces values per field type, applies rules, and returns `{ ok, errors,
activeValues }`. `activeValues` drops hidden fields so they are never persisted or
treated as required. `validateAttachment(ref, allowed, maxBytes)` validates a
reference against the allowlist + cap.

## Resources

- D1 (`DB`): `forms`, `form_submissions`, plus `submission_keys` (idempotency
  ledger) — migration `0001`.

## Verification

```bash
pnpm --filter @microservices-sh/forms-intake build
pnpm --filter @microservices-sh/forms-intake check:spec
```
