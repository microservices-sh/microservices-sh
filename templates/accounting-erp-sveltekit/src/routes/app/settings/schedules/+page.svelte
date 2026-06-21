<script lang="ts">
  import { enhance } from "$app/forms";
  import { Alert, Button, Card, EmptyState, Field, PageHeader } from "$lib/ui";

  let { data, form } = $props();

  const when = (iso?: string | null) => iso ? new Date(iso).toLocaleString() : "n/a";
  const interval = (ms: number) => {
    const minutes = Math.round(ms / 60_000);
    if (minutes < 60) return `${minutes}m`;
    const hours = minutes / 60;
    return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
  };
</script>

<svelte:head>
  <title>Job schedules · ERP Shell</title>
</svelte:head>

<main class="section schedules-page">
  <PageHeader
    eyebrow="Automation"
    title="Job schedules"
    description="Define recurring schedules for background work. The live queue and one-off enqueue actions live under Jobs."
  >
    {#snippet actions()}
      {#if data.canManage}
        <form method="POST" action="?/catchUp" use:enhance>
          <Button type="submit" variant="ghost" size="sm">Catch up due</Button>
        </form>
      {/if}
    {/snippet}
  </PageHeader>

  {#if form?.catchUp}
    <Alert tone="success">Schedule catch-up enqueued {form.enqueuedCount} job{form.enqueuedCount === 1 ? "" : "s"}.</Alert>
  {:else if form?.scheduled}
    <Alert tone="success">Schedule saved.</Alert>
  {:else if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <div class="content-grid mt-6">
    <Card title="Schedules">
      {#if data.schedules.length > 0}
        <div class="table-scroll">
          <table>
            <caption>Recurring job schedules</caption>
            <thead>
              <tr>
                <th scope="col">Type</th>
                <th scope="col">Interval</th>
                <th scope="col">Next run</th>
                <th scope="col">Last run</th>
              </tr>
            </thead>
            <tbody>
              {#each data.schedules as schedule}
                <tr>
                  <td><code>{schedule.type}</code></td>
                  <td>{interval(schedule.intervalMs)}</td>
                  <td>{when(schedule.nextRunAt)}</td>
                  <td>{when(schedule.lastRunAt)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <EmptyState title="No schedules yet" description="No recurring schedules have been created." />
      {/if}
    </Card>

    {#if data.canManage}
      <Card title="Create a schedule">
        <form method="POST" action="?/schedule" use:enhance>
          <Field label="Type" id="schedule-type"><input id="schedule-type" name="type" required placeholder="daily-reconciliation" /></Field>
          <Field label="Payload JSON" id="schedule-payload"><textarea id="schedule-payload" name="payload" rows="5" placeholder='&#123;"source":"stripe"&#125;'></textarea></Field>
          <div class="form-row">
            <Field label="Interval minutes" id="schedule-interval"><input id="schedule-interval" name="intervalMinutes" type="number" min="1" value="1440" /></Field>
            <Field label="Max attempts" id="schedule-max-attempts"><input id="schedule-max-attempts" name="maxAttempts" type="number" min="1" max="50" value="5" /></Field>
          </div>
          <Field label="First run" id="schedule-first-run"><input id="schedule-first-run" name="firstRunAt" type="datetime-local" /></Field>
          <Button type="submit" variant="primary">Save schedule</Button>
        </form>
      </Card>
    {/if}
  </div>
</main>

<style>
  .schedules-page :global(.card__body) {
    min-width: 0;
  }
  .table-scroll {
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 520px;
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
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  @media (max-width: 560px) {
    .form-row {
      grid-template-columns: 1fr;
    }
  }
</style>
