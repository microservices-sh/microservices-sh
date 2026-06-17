<script lang="ts">
  import { statusBadgeVariant, formatMoney } from "$lib/status";
  import { Button, Card, Eyebrow, Badge } from "$lib/ui";
  let { data } = $props();
</script>

<svelte:head>
  <title>Admin · Client Portal</title>
</svelte:head>

<main class="section">
  <div class="content-grid">
    <section>
      <Eyebrow>Staff admin</Eyebrow>
      <h1>Portal operations.</h1>
      <p>Overview of customers, invoices, and documents across the workspace.</p>
      <div class="stat-grid" aria-label="Operational totals">
        <a class="stat-card" href="/admin/invoices">
          <span>Invoices</span>
          <strong>{data.counts.invoices}</strong>
        </a>
        <a class="stat-card" href="/admin/customers">
          <span>Customers</span>
          <strong>{data.counts.customers}</strong>
        </a>
        <div class="stat-card">
          <span>Files</span>
          <strong>{data.counts.files}</strong>
        </div>
        <div class="stat-card">
          <span>Outstanding</span>
          <strong>{formatMoney(data.outstandingCents, data.currency)}</strong>
        </div>
      </div>
    </section>

    <Card>
      <h2>Recent invoices</h2>
      {#if data.recentInvoices.length === 0}
        <p>No invoices yet.</p>
      {:else}
        <ul class="list">
          {#each data.recentInvoices as invoice}
            <li class="list-item row-item">
              <div>
                <strong>{invoice.number ?? "Draft"}</strong>
                <p>{invoice.customerName} · {formatMoney(invoice.totalCents, invoice.currency)}</p>
              </div>
              <Badge tone={statusBadgeVariant(invoice.status)}>{invoice.status}</Badge>
            </li>
          {/each}
        </ul>
      {/if}
      <p><Button href="/admin/invoices" variant="ghost">View all invoices</Button></p>
    </Card>

    <Card>
      <h2>Recent activity</h2>
      {#if data.events.length === 0}
        <p>No audit events yet.</p>
      {:else}
        <ul class="list">
          {#each data.events as event}
            <li class="list-item">
              <strong>{event.eventName}</strong><br />
              <span>{event.entityType ?? "—"} · {new Date(event.createdAt).toLocaleString()}</span>
            </li>
          {/each}
        </ul>
      {/if}
    </Card>
  </div>
</main>
