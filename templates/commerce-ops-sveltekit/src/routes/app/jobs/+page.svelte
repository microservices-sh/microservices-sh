<script lang="ts">
  import { enhance } from "$app/forms";
  import { Alert, Badge, Button, Card, Field, PageHeader, MetricStrip } from "$lib/ui";
  import type { Metric } from "$lib/ui/types";

  let { data, form } = $props();

  const when = (iso?: string | null) => iso ? new Date(iso).toLocaleString() : "n/a";
  const asJson = (value: Record<string, unknown>) => JSON.stringify(value);

  const pending = $derived(data.jobs.filter((job) => job.status === "pending").length);
  const dead = $derived(data.jobs.filter((job) => job.status === "dead").length);

  const metrics = $derived<Metric[]>([
    { label: "Queued", value: pending, tone: pending > 0 ? "warn" : "good", hint: "pending jobs" },
    { label: "Dead-letter", value: dead, tone: dead > 0 ? "bad" : "good", hint: dead > 0 ? "needs attention" : "all clear" },
    { label: "Total", value: data.jobs.length, tone: "neutral", hint: "in queue" }
  ]);

  function jobTone(status: string): "good" | "warn" | "bad" | "neutral" {
    switch (status) {
      case "succeeded":
        return "good";
      case "running":
      case "pending":
        return "warn";
      case "dead":
        return "bad";
      default:
        return "neutral";
    }
  }
</script>

<svelte:head>
  <title>Jobs · Commerce Ops</title>
</svelte:head>

<main class="section jobs-page">
  <PageHeader
    eyebrow="Workflow runtime"
    title="Jobs"
    description="Queue health and controlled enqueue actions for background work."
  >
    {#snippet actions()}
      <Button href="/app/settings/schedules" variant="ghost">Manage schedules</Button>
    {/snippet}
  </PageHeader>

  {#if form?.enqueued}
    <Alert tone="success">Job enqueued.</Alert>
  {:else if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <div class="mt-6">
    <MetricStrip {metrics} />
  </div>

  <div class="content-grid mt-6">
    <Card>
      <div class="card-headline">
        <h2>Queue</h2>
        <Badge tone={dead > 0 ? "bad" : pending > 0 ? "warn" : "good"}>{data.jobs.length} jobs</Badge>
      </div>

      {#if data.jobs.length > 0}
        <div class="table-scroll">
          <table>
            <caption>Background jobs</caption>
            <thead>
              <tr>
                <th scope="col">Type</th>
                <th scope="col">Status</th>
                <th scope="col">Attempts</th>
                <th scope="col">Run at</th>
                <th scope="col">Payload</th>
              </tr>
            </thead>
            <tbody>
              {#each data.jobs as job}
                <tr>
                  <td><code>{job.type}</code></td>
                  <td><Badge tone={jobTone(job.status)}>{job.status}</Badge></td>
                  <td>{job.attempts}/{job.maxAttempts}</td>
                  <td>{when(job.runAt)}</td>
                  <td class="payload-cell"><code>{asJson(job.payload)}</code></td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <p class="empty">No jobs have been enqueued yet.</p>
      {/if}
    </Card>
  </div>

  {#if data.canManage}
    <div class="content-grid mt-6">
      <Card>
        <h2>Enqueue job</h2>
        <form method="POST" action="?/enqueue" use:enhance>
          <Field label="Type" id="job-type"><input id="job-type" name="type" required placeholder="send-invoice-reminder" /></Field>
          <Field label="Payload JSON" id="job-payload"><textarea id="job-payload" name="payload" rows="5" placeholder='&#123;"invoiceId":"inv_123"&#125;'></textarea></Field>
          <div class="form-row">
            <Field label="Max attempts" id="job-max-attempts"><input id="job-max-attempts" name="maxAttempts" type="number" min="1" max="50" value="5" /></Field>
            <Field label="Delay seconds" id="job-delay"><input id="job-delay" name="delaySeconds" type="number" min="0" value="0" /></Field>
          </div>
          <Field label="Idempotency key" id="job-idempotency"><input id="job-idempotency" name="idempotencyKey" placeholder="invoice-reminder:inv_123" /></Field>
          <Button type="submit" variant="primary">Enqueue</Button>
        </form>
      </Card>
    </div>
  {/if}
</main>

<style>
  .jobs-page :global(.card__body) {
    min-width: 0;
  }
  .card-headline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-block-end: 14px;
  }
  .table-scroll {
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 620px;
  }
  caption {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
  th,
  td {
    border-block-end: 1px solid var(--color-line);
    padding: 10px 8px;
    text-align: left;
    vertical-align: top;
    font-size: 0.86rem;
  }
  th {
    color: var(--color-ink-faint);
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  code {
    font-family: var(--font-mono);
    font-size: 0.78rem;
  }
  .payload-cell {
    max-inline-size: 220px;
    overflow-wrap: anywhere;
  }
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .empty {
    color: var(--color-ink-faint);
    font-size: 0.9rem;
  }
  @media (max-width: 560px) {
    .form-row {
      grid-template-columns: 1fr;
    }
  }
</style>
