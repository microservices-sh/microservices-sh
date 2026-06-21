<script lang="ts">
  import { money } from "$lib/format";
  import { Badge, Card, MetricStrip, PageHeader } from "$lib/ui";
  import type { Metric } from "$lib/ui/types";

  let { data } = $props();

  const unmatched = $derived(data.transactions.filter((tx) => tx.matchStatus === "unmatched").length);
  const statementDelta = $derived(data.transactions.reduce((total, tx) => total + tx.amountCents, 0));
  const latestImport = $derived(data.statementImports.at(-1));
  const metrics = $derived<Metric[]>([
    { label: "Bank accounts", value: data.accounts.length, tone: data.accounts.length > 0 ? "good" : "neutral", hint: "connected ledgers" },
    {
      label: "Imports",
      value: data.statementImports.length,
      tone: "info",
      hint: latestImport ? `${latestImport.importedRows} rows / ${latestImport.duplicateRows} duplicates` : "history"
    },
    { label: "Unmatched", value: unmatched, tone: unmatched > 0 ? "warn" : "good", hint: money(statementDelta) }
  ]);
</script>

<svelte:head>
  <title>Banking · Accounting ERP</title>
</svelte:head>

<main class="section banking-page">
  <PageHeader
    eyebrow="Bank reconciliation"
    title="Banking"
    description="Statement import, matching, and reconciliation-session workflow from the StackSuite bank-reconciliation module."
  />

  <MetricStrip {metrics} />

  <div class="grid mt-6">
    <Card title="Statement transactions">
      {#if data.transactions.length > 0}
        <ul class="list">
          {#each data.transactions as tx (tx.id)}
            <li class="list-item row-item">
              <div>
                <strong>{tx.description}</strong>
                <p>{tx.transactionDate} · {tx.transactionHash}</p>
              </div>
              <Badge tone={tx.matchStatus === "unmatched" ? "warn" : "good"}>{money(tx.amountCents)}</Badge>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="empty">No imported statement transactions.</p>
      {/if}
    </Card>

    <Card title="Reconciliation">
      {#if data.reconciliation}
        <dl class="stats">
          <div><dt>Status</dt><dd><Badge tone="warn">{data.reconciliation.status}</Badge></dd></div>
          <div><dt>Statement date</dt><dd>{data.reconciliation.statementDate}</dd></div>
          <div><dt>Statement balance</dt><dd>{money(data.reconciliation.statementBalanceCents)}</dd></div>
          <div><dt>Module status</dt><dd>{data.status.status}</dd></div>
        </dl>
      {:else}
        <p class="empty">No reconciliation session.</p>
      {/if}
    </Card>

    <Card title="Import history">
      {#if data.statementImports.length > 0}
        <ul class="list">
          {#each data.statementImports as statementImport (statementImport.id)}
            <li class="list-item row-item">
              <div>
                <strong>{statementImport.fileName ?? statementImport.source}</strong>
                <p>{statementImport.importedAt ?? statementImport.createdAt} · {statementImport.totalRows} rows</p>
              </div>
              <Badge tone={statementImport.status === "completed" ? "good" : "warn"}>
                {statementImport.importedRows}/{statementImport.duplicateRows}
              </Badge>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="empty">No statement import history.</p>
      {/if}
    </Card>
  </div>
</main>

<style>
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(300px, 0.8fr);
    gap: 16px;
  }
  .stats {
    display: grid;
    gap: 10px;
    margin: 0;
  }
  .stats div {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border-block-end: 1px solid var(--color-line);
    padding-block-end: 10px;
  }
  .stats dt {
    color: var(--color-ink-faint);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .stats dd {
    margin: 0;
  }
  .empty,
  p {
    color: var(--color-ink-faint);
    font-size: 0.9rem;
  }
  @media (max-width: 860px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>
