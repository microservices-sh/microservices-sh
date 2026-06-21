<script lang="ts">
  import { enhance } from "$app/forms";
  import { Alert, Button, Card, Field, FormActions, PageHeader } from "$lib/ui";

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
  <title>New Project | ERP Shell</title>
</svelte:head>

<main class="section narrow">
  <PageHeader eyebrow="Project progress" title="New project" description="Create a customer project timeline.">
    {#snippet actions()}
      <Button href="/app/project-progress" variant="ghost">Back to projects</Button>
    {/snippet}
  </PageHeader>

  {#if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <Card>
    <form method="POST" use:enhance={onEnhance}>
      <Field label="Customer" id="project-customer" required>
        <select id="project-customer" name="customerId" required>
          <option value="">Choose customer</option>
          {#each data.customers as customer (customer.id)}
            <option value={customer.id} selected={form?.values?.customerId === customer.id}>{customer.name}</option>
          {/each}
        </select>
      </Field>
      <Field label="Title" id="project-title" required>
        <input id="project-title" name="title" required value={form?.values?.title ?? ""} />
      </Field>
      <Field label="Status" id="project-status">
        <select id="project-status" name="status">
          <option value="planning" selected={(form?.values?.status ?? "planning") === "planning"}>Planning</option>
          <option value="in_progress" selected={form?.values?.status === "in_progress"}>In progress</option>
          <option value="on_hold" selected={form?.values?.status === "on_hold"}>On hold</option>
          <option value="completed" selected={form?.values?.status === "completed"}>Completed</option>
        </select>
      </Field>
      <Field label="Location" id="project-location" hint="Optional">
        <input id="project-location" name="location" value={form?.values?.location ?? ""} />
      </Field>
      <div class="date-grid">
        <Field label="Start date" id="project-start" hint="Optional">
          <input id="project-start" name="startDate" type="date" value={form?.values?.startDate ?? ""} />
        </Field>
        <Field label="Expected end" id="project-end" hint="Optional">
          <input id="project-end" name="expectedEndDate" type="date" value={form?.values?.expectedEndDate ?? ""} />
        </Field>
      </div>
      <Field label="Description" id="project-description" hint="Optional">
        <textarea id="project-description" name="description" rows="5">{form?.values?.description ?? ""}</textarea>
      </Field>
      <FormActions
        submitLabel="Create project"
        submittingLabel="Creating..."
        cancelHref="/app/project-progress"
        {submitting}
      />
    </form>
  </Card>
</main>

<style>
  .narrow :global(.ph),
  .narrow :global(.card) {
    max-inline-size: 680px;
  }
  .date-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  @media (max-width: 640px) {
    .date-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
