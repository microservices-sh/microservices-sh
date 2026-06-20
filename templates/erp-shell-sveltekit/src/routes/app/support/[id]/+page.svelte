<script lang="ts">
  import { enhance } from "$app/forms";
  import { PageHeader, Card, Badge, Button, Field, Alert, FormActions, WorkflowTimeline } from "$lib/ui";

  let { data, form } = $props();
  const t = $derived(data.ticket);

  let submitting = $state(false);

  function updateEnhance() {
    submitting = true;
    return async ({ update }: { update: () => Promise<void> }) => {
      submitting = false;
      await update();
    };
  }
</script>

<svelte:head>
  <title>{t.subject} · Support · ERP Shell</title>
</svelte:head>

<main class="section">
  <PageHeader eyebrow="Support ticket" title={t.subject}>
    {#snippet actions()}
      <Button href="/app/support" variant="ghost">← Support</Button>
    {/snippet}
    {#snippet meta()}
      <Badge tone={t.statusTone}>{t.status}</Badge>
      <Badge tone={t.priorityTone}>{t.priority}</Badge>
      <span>·</span>
      <span>{t.requesterEmail}</span>
    {/snippet}
  </PageHeader>

  {#if form?.updated}
    <Alert tone="success">Ticket updated.</Alert>
  {:else if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <div class="grid">
    <div class="grid__main">
      <Card title="Summary">
        <dl class="detail-list">
          <div>
            <dt>Requester</dt>
            <dd>
              {#if t.customerId}
                <a href={`/app/customers/${t.customerId}`}>{t.customerName}</a>
                <span class="muted">· {t.requesterEmail}</span>
              {:else}
                {t.requesterEmail}
              {/if}
            </dd>
          </div>
          <div><dt>Status</dt><dd><Badge tone={t.statusTone}>{t.status}</Badge></dd></div>
          <div><dt>Priority</dt><dd><Badge tone={t.priorityTone}>{t.priority}</Badge></dd></div>
          <div><dt>Created</dt><dd>{t.created || "—"}</dd></div>
        </dl>
      </Card>

      <Card title="Description">
        {#if t.description}
          <p class="description">{t.description}</p>
        {:else}
          <p class="muted">No description provided.</p>
        {/if}
      </Card>

      <Card title="Activity">
        <WorkflowTimeline events={data.timeline} emptyLabel="No activity recorded for this ticket yet." />
      </Card>
    </div>

    <div class="grid__side">
      {#if data.canManage}
        <Card title="Update">
          <form method="POST" action="?/updateTicket" use:enhance={updateEnhance}>
            <Field label="Status" id="status">
              <select id="status" name="status" value={t.status}>
                {#each data.statusOptions as opt (opt.value)}
                  <option value={opt.value}>{opt.label}</option>
                {/each}
              </select>
            </Field>
            <Field label="Priority" id="priority">
              <select id="priority" name="priority" value={t.priority}>
                {#each data.priorityOptions as opt (opt.value)}
                  <option value={opt.value}>{opt.label}</option>
                {/each}
              </select>
            </Field>
            <FormActions submitLabel="Save" submittingLabel="Saving…" {submitting} />
          </form>
        </Card>
      {/if}
    </div>
  </div>
</main>

<style>
  .grid {
    display: grid;
    gap: 18px;
    margin-block-start: 4px;
    grid-template-columns: minmax(0, 1.5fr) minmax(280px, 0.85fr);
    align-items: start;
  }
  .grid__main,
  .grid__side {
    display: grid;
    gap: 16px;
    min-inline-size: 0;
  }
  @media (max-width: 900px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
  .description {
    margin: 0;
    white-space: pre-wrap;
    color: var(--color-ink);
  }
  .muted {
    color: var(--color-ink-soft);
  }
</style>
