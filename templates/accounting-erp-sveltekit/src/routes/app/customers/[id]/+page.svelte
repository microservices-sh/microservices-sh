<script>
  import { enhance } from "$app/forms";
  import {
    PageHeader,
    Card,
    Badge,
    Button,
    Field,
    Alert,
    FormActions,
    EntitySummaryPanel,
    WorkflowTimeline,
    EmptyState
  } from "$lib/ui";

  let { data, form } = $props();
  const c = $derived(data.customer);
  const s = $derived(data.summary);

  let editing = $state(false);
  let submitting = $state(false);

  function editEnhance() {
    submitting = true;
    return async ({ result, update }) => {
      submitting = false;
      if (result.type === "success") editing = false;
      await update();
    };
  }

  const rows = $derived([
    { label: "Email", value: c.email },
    { label: "Phone", value: c.phone ?? "—" },
    { label: "Customer", value: c.since ? `joined ${c.since}` : "—" },
    { label: "Lifetime", value: s.lifetime },
    { label: "Outstanding", value: s.outstanding }
  ]);
</script>

<svelte:head>
  <title>{c.name} · Customers · ERP Shell</title>
</svelte:head>

<main class="section">
  <PageHeader eyebrow="Customer 360" title={c.name} description={c.notes ?? undefined}>
    {#snippet actions()}
      <Button href="/app/customers" variant="ghost">← All customers</Button>
      {#if data.canManage && !editing}
        <Button variant="ghost" onclick={() => (editing = true)}>Edit</Button>
      {/if}
      <Button href="/app/invoices/new" variant="primary">New invoice</Button>
    {/snippet}
    {#snippet meta()}
      <span>{s.invoiceCount} invoice{s.invoiceCount === 1 ? "" : "s"}</span>
      <span>{s.fileCount} file{s.fileCount === 1 ? "" : "s"}</span>
      <span>{s.openTickets} open ticket{s.openTickets === 1 ? "" : "s"}</span>
      {#if s.hasOutstanding}<Badge tone="warn">{s.outstanding} outstanding</Badge>{/if}
    {/snippet}
  </PageHeader>

  {#if form?.updated}
    <Alert tone="success">Customer updated.</Alert>
  {:else if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <div class="grid">
    <div class="grid__main">
      <Card title="Invoices">
        {#if data.invoices.length === 0}
          <EmptyState title="No invoices yet" description="Issue one to start billing this customer.">
            {#snippet action()}<Button href="/app/invoices" variant="primary">Create invoice</Button>{/snippet}
          </EmptyState>
        {:else}
          <ul class="list">
            {#each data.invoices as inv (inv.id)}
              <li class="list-item row-item">
                <div>
                  <strong>{inv.number}</strong>
                  <p>{inv.balance} outstanding{#if inv.due} · due {inv.due}{/if}</p>
                </div>
                <span class="row-end">
                  {#if inv.overdue}<Badge tone="bad">overdue</Badge>{/if}
                  <Badge tone={inv.tone}>{inv.status}</Badge>
                  <span class="amount">{inv.total}</span>
                </span>
              </li>
            {/each}
          </ul>
        {/if}
      </Card>

      <Card title="Files">
        {#if data.files.length === 0}
          <EmptyState title="No files" description="Documents attached to this customer appear here." />
        {:else}
          <ul class="list">
            {#each data.files as f (f.id)}
              <li class="list-item row-item">
                <div><strong>{f.name}</strong><p>{f.size} · {f.uploaded}</p></div>
              </li>
            {/each}
          </ul>
        {/if}
      </Card>

      <Card title="Support tickets">
        {#if data.tickets.length === 0}
          <EmptyState title="No tickets" description="This customer has no support history." />
        {:else}
          <ul class="list">
            {#each data.tickets as t (t.id)}
              <li class="list-item row-item">
                <div><strong>{t.subject}</strong><p>{t.priority} · {t.age}</p></div>
                <Badge tone={t.tone}>{t.status}</Badge>
              </li>
            {/each}
          </ul>
        {/if}
      </Card>
    </div>

    <div class="grid__side">
      {#if editing}
        <Card title="Edit customer">
          <form method="POST" action="?/update" use:enhance={editEnhance}>
            <Field label="Name" id="ed-name" required>
              <input id="ed-name" name="name" required value={c.name} />
            </Field>
            <Field label="Email" id="ed-email" hint="Email can't be changed here">
              <input id="ed-email" value={c.email} disabled />
            </Field>
            <Field label="Phone" id="ed-phone" hint="Optional">
              <input id="ed-phone" name="phone" value={c.phone ?? ""} />
            </Field>
            <FormActions
              submitLabel="Save changes"
              submittingLabel="Saving…"
              oncancel={() => (editing = false)}
              {submitting}
            />
          </form>
        </Card>
      {:else}
        <EntitySummaryPanel title={c.name} subtitle={c.email} {rows} />
      {/if}
      <Card title="Activity">
        <WorkflowTimeline events={data.timeline} emptyLabel="No recorded activity for this customer." />
      </Card>
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
  .row-end {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .amount {
    font-variant-numeric: tabular-nums;
    font-size: 0.9rem;
    color: var(--color-ink);
  }
</style>
