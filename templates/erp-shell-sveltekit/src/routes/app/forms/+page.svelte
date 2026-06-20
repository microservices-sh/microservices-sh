<script lang="ts">
  import { PageHeader, Card, Badge, Button, Alert, ResourceTable, EmptyState } from "$lib/ui";

  let { data, form } = $props();

  const when = (iso: string) => new Date(iso).toLocaleString();
  const preview = (values: Record<string, unknown>) =>
    Object.entries(values)
      .map(([k, v]) => `${k}: ${v}`)
      .join(" · ") || "(no values)";
</script>

<svelte:head>
  <title>Forms · ERP Shell</title>
</svelte:head>

<main class="section">
  <PageHeader
    eyebrow="Intake forms"
    title="Forms"
    description="Review intake submissions, powered by the forms-intake module."
  >
    {#snippet actions()}
      <Button href="/app/settings/forms" variant="ghost">Manage forms</Button>
    {/snippet}
  </PageHeader>

  {#if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <div class="cols">
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
              <th></th>
            </tr>
          {/snippet}
          {#each data.forms as f (f.id)}
            <tr>
              <td data-label="Form" class="table-primary">{f.name}</td>
              <td data-label="Fields" class="table-num">{f.fieldCount}</td>
              <td data-label="Status">
                <Badge tone={f.status === "published" ? "good" : "neutral"}>{f.status}</Badge>
              </td>
              <td class="table-action">
                <a
                  class="forms-view"
                  href={`/app/forms?form=${f.id}`}
                  class:is-active={data.selectedFormId === f.id}>View submissions</a
                >
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

    <Card title="Submissions">
      {#snippet header()}
        {#if data.selectedFormId}<Badge tone="neutral">{data.submissions.length}</Badge>{/if}
      {/snippet}
      {#if !data.selectedFormId}
        <EmptyState
          title="No form selected"
          description="Pick a form's “View submissions” to see its intake here."
        />
      {:else if data.submissions.length > 0}
        <ResourceTable class="flush" caption="Form submissions">
          {#snippet head()}
            <tr>
              <th>Values</th>
              <th>Submitted</th>
            </tr>
          {/snippet}
          {#each data.submissions as sub (sub.id)}
            <tr>
              <td data-label="Values" class="sub-values">{preview(sub.values)}</td>
              <td data-label="Submitted" class="sub-meta">{when(sub.submittedAt)}</td>
            </tr>
          {/each}
        </ResourceTable>
      {:else}
        <EmptyState title="No submissions yet" description="Submissions for this form will appear here." />
      {/if}
    </Card>
  </div>
</main>

<style>
  .cols {
    display: grid;
    gap: 18px;
    margin-block-start: 4px;
    grid-template-columns: minmax(0, 1.4fr) minmax(300px, 0.9fr);
    align-items: start;
  }
  @media (max-width: 900px) {
    .cols {
      grid-template-columns: 1fr;
    }
  }
  .forms-view {
    font-size: 0.82rem;
    color: var(--color-ink-soft);
  }
  .forms-view.is-active {
    color: var(--color-act);
    font-weight: 600;
  }
  .sub-values {
    font-size: 0.88rem;
  }
  .sub-meta {
    font-size: 0.74rem;
    font-family: var(--font-mono);
    color: var(--color-ink-faint);
    white-space: nowrap;
  }
</style>
