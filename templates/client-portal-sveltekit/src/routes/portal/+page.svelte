<script lang="ts">
  import { statusBadgeVariant, formatMoney } from "$lib/status";
  import { Button, Panel, Eyebrow, Badge } from "$lib/components";
  let { data } = $props();
</script>

<svelte:head>
  <title>Your portal · Client Portal</title>
</svelte:head>

<main class="section">
  <div class="content-grid">
    <section>
      <Eyebrow>Your account</Eyebrow>
      <h1>Welcome back.</h1>
      <p>Signed in as {data.email}. Here is a summary of your invoices and documents.</p>
      <div class="stat-grid" aria-label="Account summary">
        <a class="stat-card" href="/portal/invoices">
          <span>Invoices</span>
          <strong>{data.counts.invoices}</strong>
        </a>
        <div class="stat-card">
          <span>Open</span>
          <strong>{data.counts.openInvoices}</strong>
        </div>
        <div class="stat-card">
          <span>Outstanding</span>
          <strong>{formatMoney(data.outstandingCents, data.currency)}</strong>
        </div>
        <a class="stat-card" href="/portal/files">
          <span>Files</span>
          <strong>{data.counts.files}</strong>
        </a>
      </div>
    </section>

    <Panel>
      <h2>Recent invoices</h2>
      {#if data.invoices.length === 0}
        <p>No invoices yet.</p>
      {:else}
        <ul class="list">
          {#each data.invoices as invoice}
            <li class="list-item row-item">
              <div>
                <a href={`/portal/invoices/${invoice.id}`}>
                  <strong>{invoice.number ?? "Draft"}</strong>
                </a>
                <p>{formatMoney(invoice.totalCents, invoice.currency)}</p>
              </div>
              <Badge variant={statusBadgeVariant(invoice.status)}>{invoice.status}</Badge>
            </li>
          {/each}
        </ul>
      {/if}
      <p><Button href="/portal/invoices" variant="secondary">View all invoices</Button></p>
    </Panel>

    <Panel>
      <h2>Recent documents</h2>
      {#if data.files.length === 0}
        <p>No documents yet.</p>
      {:else}
        <ul class="list">
          {#each data.files as file}
            <li class="list-item row-item">
              <div>
                <strong>{file.originalName}</strong>
                <p>{file.contentType} · {Math.ceil(file.bytes / 1024)} KB</p>
              </div>
              <Badge variant={statusBadgeVariant(file.status)}>{file.status}</Badge>
            </li>
          {/each}
        </ul>
      {/if}
      <p><Button href="/portal/files" variant="secondary">View all files</Button></p>
    </Panel>
  </div>
</main>
