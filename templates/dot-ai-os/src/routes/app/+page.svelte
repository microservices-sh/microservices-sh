<script lang="ts">
  import { Badge, Button, Eyebrow } from "$lib/ui";
  import {
    aiWorkers,
    contentItems,
    focusBlocks,
    highPriorityTasks,
    knowledgeItems,
    openTasks,
    reviewSignals
  } from "$lib/os-data";

  let { data } = $props();

  const money = (cents: number, currency: string) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);

  const currentBlock = focusBlocks[0];

  function energyTone(energy: string): "good" | "info" | "neutral" {
    if (energy === "Deep") return "good";
    if (energy === "Comms") return "info";
    return "neutral";
  }
</script>

<svelte:head>
  <title>Workbench · DOT AI OS</title>
</svelte:head>

<main class="section os-home">
  <div class="os-hero">
    <div>
      <Eyebrow>Clear Workbench</Eyebrow>
      <h1>Today is a working system.</h1>
      <p>
        DOT AI OS turns loose tasks, calendar blocks, knowledge captures, content ideas, and agent handoffs into
        one calm operator surface.
      </p>
    </div>
    <div class="unlock-card" aria-label="Daily unlock status">
      <span>Daily unlock</span>
      <strong>Ready to close</strong>
      <p>Review is the final write before the OS treats today as complete.</p>
      <Button href="/app/review" variant="primary" size="sm">Open review</Button>
    </div>
  </div>

  <div class="stat-grid os-stat-grid">
    <a class="stat-card" href="/app/tasks">
      <span>Open tasks</span>
      <strong>{openTasks.length}</strong>
    </a>
    <a class="stat-card" href="/app/focus">
      <span>Focus blocks</span>
      <strong>{focusBlocks.length}</strong>
    </a>
    <a class="stat-card" href="/app/knowledge">
      <span>Knowledge</span>
      <strong>{knowledgeItems.length}</strong>
    </a>
    <a class="stat-card" href="/app/team">
      <span>Workspace team</span>
      <strong>{data.memberCount}</strong>
    </a>
  </div>

  <div class="workbench-grid">
    <section class="panel day-panel">
      <div class="section-head">
        <div>
          <Eyebrow>Focus plan</Eyebrow>
          <h2>Stable timeline</h2>
        </div>
        <Button href="/app/focus" size="sm">Plan day</Button>
      </div>
      <ol class="timeline-list" aria-label="Today timeline">
        {#each focusBlocks as block}
          <li class:block-current={block.id === currentBlock.id}>
            <time>{block.time}</time>
            <div>
              <strong>{block.title}</strong>
              <span>{block.note}</span>
            </div>
            <Badge tone={energyTone(block.energy)}>{block.energy}</Badge>
          </li>
        {/each}
      </ol>
    </section>

    <section class="panel task-panel">
      <div class="section-head">
        <div>
          <Eyebrow>Priority queue</Eyebrow>
          <h2>Must decide next</h2>
        </div>
        <Button href="/app/tasks" size="sm">Open tasks</Button>
      </div>
      <ul class="list" role="list">
        {#each highPriorityTasks as task}
          <li class="list-item work-row">
            <div>
              <strong>{task.title}</strong>
              <span>{task.detail}</span>
            </div>
            <Badge tone="warn">{task.priority}</Badge>
          </li>
        {/each}
      </ul>
    </section>

    <section class="panel review-panel">
      <div class="section-head">
        <div>
          <Eyebrow>Review loop</Eyebrow>
          <h2>Close the work cleanly</h2>
        </div>
        <Button href="/app/review" size="sm">Review</Button>
      </div>
      <div class="signal-grid">
        {#each reviewSignals as signal}
          <div>
            <span>{signal.label}</span>
            <strong>{signal.value}</strong>
          </div>
        {/each}
      </div>
      <p>Keep the review short: shipped work, unresolved loops, agent handoffs, and tomorrow's first move.</p>
    </section>

    <section class="panel agent-panel">
      <div class="section-head">
        <div>
          <Eyebrow>AI team</Eyebrow>
          <h2>Route work to roles</h2>
        </div>
        <Button href="/app/ai-team" size="sm">Open roster</Button>
      </div>
      <div class="worker-strip">
        {#each aiWorkers.slice(0, 4) as worker}
          <a href="/app/ai-team" aria-label={`Open ${worker.name}`}>
            <strong>{worker.name}</strong>
            <span>{worker.role}</span>
          </a>
        {/each}
      </div>
    </section>

    <section class="panel content-panel">
      <div class="section-head">
        <div>
          <Eyebrow>Content pipeline</Eyebrow>
          <h2>Knowledge into output</h2>
        </div>
        <Button href="/app/content" size="sm">Open pipeline</Button>
      </div>
      <ul class="list" role="list">
        {#each contentItems.slice(0, 2) as item}
          <li class="list-item work-row">
            <div>
              <strong>{item.title}</strong>
              <span>{item.angle}</span>
            </div>
            <Badge tone={item.status === "draft" ? "info" : "neutral"}>{item.status}</Badge>
          </li>
        {/each}
      </ul>
    </section>

    <section class="panel module-panel">
      <div class="section-head">
        <div>
          <Eyebrow>Module-backed surfaces</Eyebrow>
          <h2>Business system primitives</h2>
        </div>
      </div>
      <div class="module-grid">
        <a href="/app/customers"><span>Contacts</span><strong>{data.customerCount}</strong></a>
        <a href="/app/invoices"><span>Work packets</span><strong>{data.invoiceCount}</strong></a>
        <a href="/app/invoices"><span>Open value</span><strong>{money(data.outstandingCents, data.currency)}</strong></a>
        <a href="/app/support"><span>Support</span><strong>{data.openInvoiceCount}</strong></a>
      </div>
    </section>
  </div>
</main>

<style>
  .os-home {
    display: grid;
    gap: 24px;
  }
  .os-hero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(260px, 340px);
    gap: 20px;
    align-items: stretch;
  }
  .os-hero h1 {
    max-inline-size: 18ch;
  }
  .unlock-card {
    display: grid;
    align-content: start;
    gap: 10px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-card);
    background: var(--color-surface);
    padding: 18px;
    box-shadow: var(--shadow-card);
  }
  .unlock-card > span,
  .signal-grid span,
  .module-grid span {
    color: var(--color-muted);
    font-size: 0.78rem;
    font-weight: 650;
    text-transform: uppercase;
  }
  .unlock-card strong {
    color: var(--color-ink);
    font-size: 1.18rem;
  }
  .unlock-card p {
    margin: 0;
  }
  .os-stat-grid {
    margin-block-start: 0;
  }
  .workbench-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(300px, 0.8fr);
    gap: 18px;
  }
  .day-panel {
    grid-row: span 2;
  }
  .timeline-list {
    display: grid;
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .timeline-list li {
    display: grid;
    grid-template-columns: 90px minmax(0, 1fr) max-content;
    gap: 14px;
    align-items: start;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-control);
    background: var(--color-surface);
    padding: 14px;
  }
  .timeline-list li.block-current {
    border-color: var(--color-accent);
    background: var(--color-accent-soft);
  }
  .timeline-list time {
    color: var(--color-ink);
    font-family: var(--font-mono);
    font-size: 0.78rem;
  }
  .timeline-list div,
  .work-row div {
    display: grid;
    gap: 4px;
    min-inline-size: 0;
  }
  .timeline-list strong,
  .work-row strong {
    color: var(--color-ink);
  }
  .timeline-list span,
  .work-row span {
    color: var(--color-muted);
    font-size: 0.9rem;
  }
  .work-row {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 14px;
  }
  .signal-grid,
  .module-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 10px;
  }
  .signal-grid div,
  .module-grid a {
    display: grid;
    gap: 3px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-control);
    background: var(--color-surface-2);
    padding: 12px;
    text-decoration: none;
  }
  .signal-grid strong,
  .module-grid strong {
    color: var(--color-ink);
    font-size: 1.05rem;
  }
  .worker-strip {
    display: grid;
    gap: 10px;
  }
  .worker-strip a {
    display: grid;
    gap: 2px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-control);
    padding: 12px;
    text-decoration: none;
  }
  .worker-strip span {
    color: var(--color-muted);
    font-size: 0.86rem;
  }
  .module-panel {
    grid-column: 1 / -1;
  }
  @media (max-width: 900px) {
    .os-hero,
    .workbench-grid {
      grid-template-columns: 1fr;
    }
    .day-panel {
      grid-row: auto;
    }
  }
  @media (max-width: 620px) {
    .timeline-list li {
      grid-template-columns: 1fr;
    }
  }
</style>
