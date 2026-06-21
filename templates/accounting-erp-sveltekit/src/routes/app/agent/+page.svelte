<script lang="ts">
  import { PageHeader, MetricStrip, Card, Badge, Button, WorkflowTimeline, EmptyState } from "$lib/ui";
  import type { Metric } from "$lib/ui/types";

  let { data } = $props();
  const s = $derived(data.stats);

  const metrics = $derived<Metric[]>([
    { label: "Connected modules", value: s.moduleCount, tone: "info", hint: "tools the agent can call" },
    { label: "Tools available", value: s.toolCount, tone: "neutral", hint: `${s.writeCount} writes gated` },
    { label: "Writes gated", value: s.writeCount, tone: "warn", hint: "need an approver" },
    { label: "Actions logged", value: s.loggedCount, tone: "good", hint: "recent, audited" }
  ]);
</script>

<svelte:head>
  <title>Agent center · Accounting ERP</title>
</svelte:head>

<main class="section">
  <PageHeader
    eyebrow="Automation"
    title="Agent center"
    description="Agents operate this workspace through the same module use-cases your team uses. Reads run freely; writes pause at the approval gate. Every call lands in the audit log below."
  >
    {#snippet meta()}
      <Badge tone={data.runtime.connected ? "good" : "warn"}>{data.runtime.mode}</Badge>
      <span>Writes require the <code>member.manage</code> role</span>
    {/snippet}
  </PageHeader>

  <MetricStrip {metrics} />

  <div class="grid">
    <div class="grid__main">
      <Card title="Action log">
        {#snippet header()}<Badge tone="info">live · audit</Badge>{/snippet}
        <WorkflowTimeline
          events={data.stream}
          emptyLabel="No actions yet. Issue an invoice or record a payment and it appears here."
        />
      </Card>
    </div>

    <div class="grid__side">
      <Card title="Approval gate">
        {#if data.canApprove}
          <p class="gate gate--ok">
            <strong>You can approve writes.</strong>
            Your <code>member.manage</code> role lets you release held actions.
          </p>
        {:else}
          <p class="gate">
            <strong>Writes are held for an approver.</strong>
            You can run reads; a teammate with <code>member.manage</code> approves write actions.
          </p>
        {/if}
        <div class="gate__queue">
          <span>Awaiting approval</span>
          <Badge tone="good">0</Badge>
        </div>
        <p class="gate__note">
          Nothing is queued. When an agent proposes a write ({s.writeCount} gated tools), it pauses here with the
          tenant, actor, and payload recorded.
        </p>
      </Card>

      <Card title="Connected tools" class="stack">
        {#if data.capabilities.length === 0}
          <EmptyState title="No modules enabled" description="Enable a module to expose its tools." />
        {:else}
          <ul class="caps">
            {#each data.capabilities as cap (cap.href)}
              <li class="cap">
                <a class="cap__name" href={cap.href}>{cap.label}</a>
                <div class="cap__tools">
                  {#each cap.reads as r (r)}<Badge tone="neutral">{r}</Badge>{/each}
                  {#each cap.writes as w (w)}<Badge tone="warn">{w}</Badge>{/each}
                </div>
              </li>
            {/each}
          </ul>
          <p class="caps__legend">
            <Badge tone="neutral">read</Badge> runs freely ·
            <Badge tone="warn">write</Badge> needs approval
          </p>
        {/if}
      </Card>
    </div>
  </div>
</main>

<style>
  .grid {
    display: grid;
    gap: 18px;
    margin-block-start: 22px;
    grid-template-columns: minmax(0, 1.3fr) minmax(300px, 1fr);
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
  .gate {
    margin: 0 0 14px;
    font-size: 0.9rem;
    color: var(--color-ink-soft);
    max-inline-size: none;
  }
  .gate strong {
    display: block;
    color: var(--color-ink);
  }
  .gate--ok strong {
    color: var(--color-green-dark);
  }
  .gate__queue {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    background: var(--color-panel-subtle);
    font-size: 0.82rem;
    color: var(--color-ink-soft);
  }
  .gate__note {
    margin: 10px 0 0;
    font-size: 0.8rem;
    color: var(--color-ink-faint);
    max-inline-size: none;
  }
  .caps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 12px;
  }
  .cap {
    display: grid;
    gap: 6px;
  }
  .cap__name {
    font-size: 0.9rem;
    font-weight: 600;
  }
  .cap__tools {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .caps__legend {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 14px 0 0;
    padding-block-start: 12px;
    border-block-start: 1px solid var(--color-line);
    font-size: 0.78rem;
    color: var(--color-ink-faint);
    max-inline-size: none;
  }
</style>
