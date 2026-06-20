<script lang="ts">
  import { enhance } from "$app/forms";
  import { PageHeader, Card, Badge, Button, Field, Alert, ResourceTable, EmptyState } from "$lib/ui";

  let { data, form } = $props();
</script>

<svelte:head>
  <title>Form builder · ERP Shell</title>
</svelte:head>

<main class="section">
  <PageHeader
    eyebrow="Forms"
    title="Form builder"
    description="Create intake forms and configure spam protection, powered by the forms-intake module."
  />

  {#if form?.created}
    <Alert tone="success">Form created.</Alert>
  {:else if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <div class="stack">
    <Card title="Forms">
      {#snippet header()}
        <Badge tone="neutral">{data.forms.length}</Badge>
      {/snippet}
      {#if data.forms.length > 0}
        <ResourceTable class="flush" caption="Intake forms">
          {#snippet head()}
            <tr>
              <th>Form</th>
              <th class="table-num">Fields</th>
              <th>Status</th>
            </tr>
          {/snippet}
          {#each data.forms as f (f.id)}
            <tr>
              <td data-label="Form" class="table-primary">{f.name}</td>
              <td data-label="Fields" class="table-num">{f.fieldCount}</td>
              <td data-label="Status">
                <Badge tone={f.status === "published" ? "good" : "neutral"}>{f.status}</Badge>
              </td>
            </tr>
          {/each}
        </ResourceTable>
      {:else}
        <EmptyState
          title="No forms yet"
          description="Create one to start collecting submissions."
        />
      {/if}
    </Card>

    {#if data.canManage}
      <Card title="Create a form">
        <form method="POST" action="?/createForm" use:enhance>
          <Field label="Form name" id="name" required>
            <input id="name" name="name" required placeholder="Contact us" />
          </Field>
          <label class="forms-check">
            <input type="checkbox" name="requireTurnstile" /> Require Turnstile (spam protection)
          </label>
          <Button type="submit" variant="primary">Create form</Button>
        </form>
      </Card>
    {/if}
  </div>
</main>

<style>
  .stack {
    display: grid;
    gap: 18px;
    margin-block-start: 4px;
    align-items: start;
  }
  .forms-check {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-block: 4px 14px;
    font-size: 0.88rem;
    color: var(--color-ink-soft);
  }
</style>
