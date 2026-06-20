<script lang="ts">
  // Interactive wrapper for the forms-intake module. Auto-discovered by the harness
  // (wrappers/<module-id>.svelte). No live backend — the form definition is plain
  // serializable data and the Preview validates submissions with the module's real
  // validateSubmission. A valid submit records an intake (mirrors submitForm →
  // forms-intake.submission_received); invalid input is rejected by the same rules.
  import Preview from "@microservices-sh/forms-intake/preview";
  import type { FormField } from "@microservices-sh/forms-intake/types";

  let { module: m }: { module: any } = $props();

  // A published form's field set — type + validation rules + conditional visibility,
  // all JSON. "Company" only shows (and is only required) when reason = "business".
  const fields: FormField[] = [
    { id: "name", label: "Your name", type: "text", required: true, validation: { minLength: 2, maxLength: 80 } },
    { id: "email", label: "Email", type: "email", required: true, validation: { pattern: "[^@\\s]+@[^@\\s]+\\.[^@\\s]+" } },
    { id: "reason", label: "Reason for contact", type: "select", required: true, validation: { options: ["general", "business", "support"] } },
    { id: "company", label: "Company", type: "text", required: true, validation: { minLength: 2 }, visibleWhen: { field: "reason", equals: "business" } },
    { id: "seats", label: "Team size", type: "number", required: false, validation: { min: 1, max: 5000 }, visibleWhen: { field: "reason", equals: "business" } },
    { id: "consent", label: "I agree to be contacted", type: "checkbox", required: true }
  ];

  let subSeq = 1;
  let submissions = $state<any[]>([
    { id: `sub_${subSeq++}`, values: { name: "Grace Hopper", email: "grace@navy.mil", reason: "support", consent: true }, submittedAt: new Date(Date.now() - 36e5).toISOString() }
  ]);

  function onsubmit(values: Record<string, string | number | boolean>) {
    submissions = [{ id: `sub_${subSeq++}`, values, submittedAt: new Date().toISOString() }, ...submissions];
  }
</script>

<Preview formName="Contact us" {fields} {submissions} {onsubmit} />
