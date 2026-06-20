<script lang="ts">
  import { enhance } from "$app/forms";
  import { PageHeader, Card, Button, Field, Alert, FormActions, EmptyState } from "$lib/ui";

  let { data, form } = $props();
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
  <title>New subscription · ERP Shell</title>
</svelte:head>

<main class="section narrow">
  <PageHeader eyebrow="Billing" title="New subscription" description="Start a recurring subscription for a customer.">
    {#snippet actions()}
      <Button href="/app/billing" variant="ghost">← Billing</Button>
    {/snippet}
  </PageHeader>

  {#if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <Card>
    {#if data.customers.length === 0}
      <EmptyState title="No customers yet" description="Add a customer before starting a subscription.">
        {#snippet action()}
          <Button href="/app/customers/new" variant="primary">New customer</Button>
        {/snippet}
      </EmptyState>
    {:else if data.plans.length === 0}
      <EmptyState title="No plans yet" description="Create a plan before starting a subscription.">
        {#snippet action()}
          <Button href="/app/settings/plans" variant="primary">Manage plans</Button>
        {/snippet}
      </EmptyState>
    {:else}
      <form method="POST" use:enhance={onEnhance}>
        <Field label="Customer" id="subscriberId" required>
          <select id="subscriberId" name="subscriberId" required>
            <option value="" disabled selected>Choose a customer…</option>
            {#each data.customers as c}<option value={c.id}>{c.name}</option>{/each}
          </select>
        </Field>
        <Field label="Plan" id="planId" required>
          <select id="planId" name="planId" required>
            <option value="" disabled selected>Choose a plan…</option>
            {#each data.plans as p}<option value={p.id}>{p.name}</option>{/each}
          </select>
        </Field>
        <FormActions
          submitLabel="Start subscription"
          submittingLabel="Starting…"
          cancelHref="/app/billing"
          {submitting}
        />
      </form>
    {/if}
  </Card>
</main>

<style>
  .narrow :global(.ph),
  .narrow :global(.card) {
    max-inline-size: 560px;
  }
</style>
