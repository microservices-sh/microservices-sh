<script lang="ts">
  import { statusPillClass, formatMoney } from "$lib/status";
  let { data } = $props();
</script>

<svelte:head>
  <title>Your portal · Client Portal</title>
</svelte:head>

<main class="section">
  <div class="content-grid">
    <section>
      <p class="eyebrow">Your account</p>
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

    <section class="panel">
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
              <span class={statusPillClass(invoice.status)}>{invoice.status}</span>
            </li>
          {/each}
        </ul>
      {/if}
      <p><a class="button secondary" href="/portal/invoices">View all invoices</a></p>
    </section>

    <section class="panel">
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
              <span class={statusPillClass(file.status)}>{file.status}</span>
            </li>
          {/each}
        </ul>
      {/if}
      <p><a class="button secondary" href="/portal/files">View all files</a></p>
    </section>
  </div>
</main>
