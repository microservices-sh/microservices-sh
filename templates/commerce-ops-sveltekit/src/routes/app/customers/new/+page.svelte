<script>
  import { enhance } from "$app/forms";
  import { PageHeader, Card, Button, Field, Alert, FormActions } from "$lib/ui";

  let { form } = $props();
  let submitting = $state(false);

  function onEnhance() {
    submitting = true;
    return async ({ update }) => {
      submitting = false;
      await update();
    };
  }
</script>

<svelte:head>
  <title>New customer · ERP Shell</title>
</svelte:head>

<main class="section narrow">
  <PageHeader eyebrow="Customer book" title="New customer" description="Add a customer to your company.">
    {#snippet actions()}
      <Button href="/app/customers" variant="ghost">← Customers</Button>
    {/snippet}
  </PageHeader>

  {#if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <Card>
    <form method="POST" use:enhance={onEnhance}>
      <Field label="Name" id="name" required>
        <input id="name" name="name" required value={form?.values?.name ?? ""} />
      </Field>
      <Field label="Email" id="email" required>
        <input id="email" name="email" type="email" required value={form?.values?.email ?? ""} />
      </Field>
      <Field label="Phone" id="phone" hint="Optional">
        <input id="phone" name="phone" value={form?.values?.phone ?? ""} />
      </Field>
      <FormActions
        submitLabel="Save customer"
        submittingLabel="Saving…"
        cancelHref="/app/customers"
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
