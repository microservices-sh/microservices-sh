<!--
  Forms & Intake surface — explains and demonstrates what the module does (define a
  serializable field set, render it, validate a submission with a PURE validator,
  then record it). Built on the shared DS; the form definition + recorded
  submissions are host-supplied. Validation here is the module's REAL
  validateSubmission — including conditional visibility (a hidden required field is
  not reported missing), so the demo can't drift from the backend rules.
  Reused by the module-preview harness and template routes.
-->
<script lang="ts">
  import { Eyebrow, Button } from "@microservices-sh/ui";
  import { validateSubmission } from "@microservices-sh/forms-intake/validate-submission";
  import type { FormField } from "@microservices-sh/forms-intake/types";

  type Submission = { id: string; values: Record<string, string | number | boolean>; submittedAt: string };

  let {
    formName = "Contact us",
    fields = [],
    submissions = [],
    busy = false,
    onsubmit
  }: {
    formName?: string;
    fields?: FormField[];
    submissions?: Submission[];
    busy?: boolean;
    onsubmit?: (values: Record<string, string | number | boolean>) => void;
  } = $props();

  // raw in-progress values keyed by field id
  let values = $state<Record<string, any>>({});
  let errors = $state<Record<string, string>>({});
  let rejected = $state(false);
  let accepted = $state(false);

  // UI-side visibility mirror of the validator's conditional rule — purely for
  // rendering. The authoritative check still runs inside validateSubmission.
  const isVisible = (f: FormField) => !f.visibleWhen || String(values[f.visibleWhen.field] ?? "") === f.visibleWhen.equals;
  const visibleFields = $derived(fields.filter(isVisible));

  // HTML input type for a field type (select/checkbox are handled separately).
  function inputType(type: FormField["type"]): "number" | "email" | "text" {
    if (type === "number") return "number";
    if (type === "email") return "email";
    return "text";
  }

  // Coerce a raw input string to the value the validator expects for the field.
  function coerceValue(type: FormField["type"], raw: string): string | number {
    if (type !== "number") return raw;
    return raw === "" ? "" : Number(raw);
  }

  function submit(e: Event) {
    e.preventDefault();
    const result = validateSubmission(fields, values);
    errors = Object.fromEntries(result.errors.map((er) => [er.fieldId, er.message]));
    accepted = result.ok;
    rejected = !result.ok;
    if (result.ok) {
      onsubmit?.(result.activeValues); // emits forms-intake.submission_received
      values = {};
    }
    // else: emits forms-intake.submission_rejected
  }
</script>

<header class="fi-head">
  <Eyebrow>Forms &amp; intake</Eyebrow>
  <h1 class="fi-title">Forms &amp; Intake</h1>
  <p class="fi-lede">Define a form as a <strong>serializable field set</strong>, render it, and validate every submission with a <strong>pure validator</strong> — the same rules whether the form is rendered here, in a template, or checked on the server.</p>
  <ol class="fi-how">
    <li><span class="fi-how__n mono">01</span><span><strong>Define fields</strong> — type, validation rules, and conditional visibility, all plain JSON.</span></li>
    <li><span class="fi-how__n mono">02</span><span><strong>Validate</strong> — one pure function; a required-but-<em>hidden</em> field is never reported missing.</span></li>
    <li><span class="fi-how__n mono">03</span><span><strong>Record</strong> — a valid submission emits <code>submission_received</code>; an invalid one emits <code>submission_rejected</code>.</span></li>
  </ol>
</header>

<section class="fi-console" aria-label="Fill out the form">
  <div class="fi-console__rail" aria-hidden="true"></div>
  <p class="fi-formname">{formName}</p>

  <form class="fi-form" onsubmit={submit}>
    {#each visibleFields as f (f.id)}
      <div class="fi-field" class:err={errors[f.id]}>
        {#if f.type === "checkbox"}
          <label class="fi-check">
            <input type="checkbox" checked={!!values[f.id]} onchange={(e) => (values = { ...values, [f.id]: (e.target as HTMLInputElement).checked })} />
            <span>{f.label}{#if f.required}<em class="fi-req">*</em>{/if}</span>
          </label>
        {:else}
          <label class="fi-label" for={`fi_${f.id}`}>{f.label}{#if f.required}<em class="fi-req">*</em>{/if}</label>
          {#if f.type === "select"}
            <select id={`fi_${f.id}`} value={values[f.id] ?? ""} onchange={(e) => (values = { ...values, [f.id]: (e.target as HTMLSelectElement).value })}>
              <option value="" disabled>Choose…</option>
              {#each f.validation?.options ?? [] as opt}<option value={opt}>{opt}</option>{/each}
            </select>
          {:else}
            <input
              id={`fi_${f.id}`}
              type={inputType(f.type)}
              value={values[f.id] ?? ""}
              oninput={(e) => {
                values = { ...values, [f.id]: coerceValue(f.type, (e.target as HTMLInputElement).value) };
              }}
            />
          {/if}
        {/if}
        {#if errors[f.id]}<span class="fi-msg">{errors[f.id]}</span>{/if}
      </div>
    {/each}

    <div class="fi-actions">
      <Button type="submit" variant="primary">{busy ? "Submitting…" : "Submit →"}</Button>
      {#if rejected}<span class="fi-note fi-note--rej">rejected · emitted <code>submission_rejected</code></span>
      {:else if accepted}<span class="fi-note fi-note--ok">received · emitted <code>submission_received</code></span>{/if}
    </div>
  </form>
</section>

<div class="fi-out">
  <p class="fi-out__h mono">Submissions <span>({submissions.length})</span></p>
  {#if submissions.length}
    <ul class="fi-subs">
      {#each submissions as s (s.id)}
        <li class="fi-card">
          <dl class="fi-kv">
            {#each Object.entries(s.values) as [k, v]}
              <div><dt>{k}</dt><dd>{String(v)}</dd></div>
            {/each}
          </dl>
          <span class="fi-card__when mono">{new Date(s.submittedAt).toLocaleString("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="fi-empty">Submit the form above to record an intake.</p>
  {/if}
</div>

<style>
  .fi-head { margin-bottom: 1.5rem; }
  .fi-title { font-family: var(--font-display); font-weight: 800; font-size: clamp(1.7rem, 3vw, 2.3rem); letter-spacing: -0.02em; margin: 0.35rem 0 0.5rem; }
  .fi-lede { color: var(--color-ink-soft); max-width: 62ch; margin: 0 0 0.9rem; font-size: 1rem; }
  .fi-lede strong { color: var(--color-ink); font-weight: 600; }
  .fi-how { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; max-width: 68ch; }
  .fi-how li { display: grid; grid-template-columns: auto 1fr; gap: 0.7rem; align-items: baseline; font-size: 0.9rem; color: var(--color-ink-soft); }
  .fi-how strong { color: var(--color-ink); font-weight: 600; }
  .fi-how em { font-style: italic; }
  .fi-how code { font-family: var(--font-mono); color: var(--color-green); font-size: 0.86em; }
  .fi-how__n { color: var(--color-green); font-size: 0.72rem; }

  .fi-console { position: relative; border: 1px solid var(--color-line-strong); border-radius: 14px; background: linear-gradient(180deg, var(--color-panel), var(--color-panel-subtle)); padding: 1.2rem 1.3rem 1.2rem 1.5rem; overflow: hidden; }
  .fi-console__rail { position: absolute; inset: 0 auto 0 0; width: 3px; background: linear-gradient(180deg, var(--color-green), transparent); opacity: 0.7; }
  .fi-formname { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.07em; color: var(--color-ink-faint); font-weight: 600; margin: 0 0 0.9rem; }

  .fi-form { display: grid; gap: 0.85rem; max-width: 420px; }
  .fi-field { display: grid; gap: 0.3rem; }
  .fi-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-ink-faint); font-weight: 600; }
  .fi-req { color: var(--color-green); font-style: normal; margin-left: 0.15rem; }
  .fi-field input[type="text"], .fi-field input[type="email"], .fi-field input[type="number"], .fi-field select {
    width: 100%; background: var(--color-paper); border: 1px solid var(--color-line-strong); color: var(--color-ink); border-radius: 8px; padding: 0.5rem 0.65rem; font: inherit; font-size: 0.9rem;
  }
  .fi-field input:focus, .fi-field select:focus { outline: none; border-color: var(--color-green); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-green) 16%, transparent); }
  .fi-field.err input, .fi-field.err select { border-color: #d9534f; box-shadow: 0 0 0 3px color-mix(in srgb, #d9534f 14%, transparent); }
  .fi-check { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; color: var(--color-ink); cursor: pointer; }
  .fi-check input { width: 1rem; height: 1rem; accent-color: var(--color-green); }
  .fi-msg { font-size: 0.76rem; color: #d9534f; }

  .fi-actions { display: flex; align-items: center; gap: 0.8rem; flex-wrap: wrap; margin-top: 0.3rem; }
  .fi-note { font-size: 0.76rem; }
  .fi-note code { font-family: var(--font-mono); font-size: 0.92em; }
  .fi-note--ok { color: var(--color-green); }
  .fi-note--rej { color: #d9534f; }

  .fi-out { margin-top: 1.6rem; }
  .fi-out__h { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-ink-faint); margin: 0 0 0.6rem; }
  .fi-empty { color: var(--color-ink-faint); font-size: 0.85rem; }

  /* white "paper" submission cards */
  .fi-subs { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }
  .fi-card {
    --p-ink: #1a1f36; --p-faint: #8a93a3; --p-line: #e6ebf1;
    display: grid; grid-template-columns: 1fr auto; align-items: start; gap: 0.9rem;
    background: #ffffff; color: var(--p-ink); border: 1px solid var(--p-line); border-radius: 11px; padding: 0.7rem 0.95rem;
    box-shadow: 0 1px 2px rgba(16, 24, 40, 0.05), 0 16px 32px -22px rgba(16, 24, 40, 0.22);
    animation: fi-rise 0.36s cubic-bezier(0.2, 0.7, 0.2, 1) both;
  }
  .fi-kv { margin: 0; display: grid; gap: 0.2rem; }
  .fi-kv div { display: grid; grid-template-columns: 7rem 1fr; gap: 0.6rem; font-size: 0.82rem; }
  .fi-kv dt { color: var(--p-faint); }
  .fi-kv dd { margin: 0; font-weight: 500; }
  .fi-card__when { font-size: 0.72rem; color: var(--p-faint); white-space: nowrap; }

  @keyframes fi-rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: reduce) { .fi-card { animation: none; } }
</style>
