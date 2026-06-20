<script lang="ts">
  import { enhance } from "$app/forms";
  import { PageHeader, Card, Button, Field, Alert, FormActions } from "$lib/ui";

  let { form } = $props();
  let submitting = $state(false);

  function onEnhance() {
    submitting = true;
    return async ({ update }: { update: () => Promise<void> }) => {
      submitting = false;
      await update();
    };
  }
</script>

<svelte:head>
  <title>New ticket · ERP Shell</title>
</svelte:head>

<main class="section narrow">
  <PageHeader eyebrow="Support" title="New ticket" description="Open a support ticket for your company.">
    {#snippet actions()}
      <Button href="/app/support" variant="ghost">← Support</Button>
    {/snippet}
  </PageHeader>

  {#if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <Card>
    <form method="POST" use:enhance={onEnhance}>
      <Field label="Subject" id="subject" required>
        <input id="subject" name="subject" required value={form?.values?.subject ?? ""} />
      </Field>
      <Field label="Requester email" id="requesterEmail" required>
        <input
          id="requesterEmail"
          name="requesterEmail"
          type="email"
          required
          value={form?.values?.requesterEmail ?? ""}
        />
      </Field>
      <Field label="Priority" id="priority">
        <select id="priority" name="priority" value={form?.values?.priority ?? "normal"}>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </Field>
      <Field label="Description" id="description" hint="Optional">
        <textarea id="description" name="description">{form?.values?.description ?? ""}</textarea>
      </Field>
      <FormActions
        submitLabel="Open ticket"
        submittingLabel="Opening…"
        cancelHref="/app/support"
        {submitting}
      />
    </form>
  </Card>
</main>

<style>
  .narrow :global(.ph),
  .narrow :global(.card) {
    max-inline-size: 560px;
  }
</style>
