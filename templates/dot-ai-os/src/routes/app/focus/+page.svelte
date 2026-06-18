<script lang="ts">
  import { Alert, Badge, Button, Eyebrow, Field } from "$lib/ui";

  let { data, form } = $props();
</script>

<svelte:head>
  <title>Focus plan · DOT AI OS</title>
</svelte:head>

<main class="section focus-page">
  <div class="focus-head">
    <div>
      <Eyebrow>Focus plan</Eyebrow>
      <h1>Shape today into executable blocks.</h1>
      <p>
        The day plan is the anchor. Tasks and calendar context can feed it, but the timeline stays stable enough to
        scan, edit, save, and sync.
      </p>
    </div>
    <div class="focus-actions">
      <form method="POST" action="?/draft">
        <Button type="submit" variant="primary">AI draft plan</Button>
      </form>
      <Button disabled>Sync Google</Button>
    </div>
  </div>

  {#if form?.error}
    <Alert>{form.error}</Alert>
  {/if}

  <div class="focus-grid">
    <section class="panel queue-panel">
      <div class="section-head">
        <div>
          <Eyebrow>Task queue</Eyebrow>
          <h2>Pull into timeline</h2>
        </div>
        <Badge tone="warn">{data.openTasks.length} open</Badge>
      </div>
      <ul class="task-queue" role="list">
        {#each data.openTasks as task}
          <li>
            <div>
              <strong>{task.title}</strong>
              <span>{task.category} · {task.dueLabel}</span>
            </div>
            <Badge tone={task.priority === "High" ? "warn" : "neutral"}>{task.priority}</Badge>
          </li>
        {:else}
          <li>
            <div>
              <strong>No open tasks</strong>
              <span>The timeline can still hold manual blocks.</span>
            </div>
            <Badge tone="neutral">clear</Badge>
          </li>
        {/each}
      </ul>
    </section>

    <section class="panel timeline-panel">
      <div class="section-head">
        <div>
          <Eyebrow>Timeline</Eyebrow>
          <h2>Calendar blocks</h2>
        </div>
        <Badge tone="info">calendar-google optional</Badge>
      </div>
      <ol class="block-stack" aria-label="Editable focus blocks">
        {#each data.focusBlocks as block}
          <li>
            <time>{block.timeRange}</time>
            <div>
              <strong>{block.title}</strong>
              <span>{block.note}</span>
            </div>
            <Badge tone={block.source === "ai-draft" ? "info" : "neutral"}>{block.energy}</Badge>
          </li>
        {:else}
          <li>
            <time>{data.date}</time>
            <div>
              <strong>No blocks yet</strong>
              <span>Draft a plan or add one manually.</span>
            </div>
            <Badge tone="neutral">empty</Badge>
          </li>
        {/each}
      </ol>
    </section>

    <form class="panel block-form" method="POST" action="?/createBlock">
      <div class="section-head">
        <div>
          <Eyebrow>Manual block</Eyebrow>
          <h2>Add to timeline</h2>
        </div>
        <Badge tone="neutral">{data.date}</Badge>
      </div>
      <input type="hidden" name="date" value={data.date} />
      <div class="block-form-grid">
        <Field label="Time" id="block-time">
          <input id="block-time" name="timeRange" required maxlength="80" autocomplete="off" placeholder="13:00-14:00" />
        </Field>
        <Field label="Energy" id="block-energy">
          <select id="block-energy" name="energy">
            <option>Deep</option>
            <option>Review</option>
            <option>Comms</option>
            <option>Admin</option>
            <option>Close</option>
          </select>
        </Field>
      </div>
      <Field label="Title" id="block-title">
        <input id="block-title" name="title" required maxlength="160" autocomplete="off" />
      </Field>
      <Field label="Note" id="block-note">
        <textarea id="block-note" name="note" rows="3" maxlength="1000"></textarea>
      </Field>
      <div class="form-actions">
        <Button type="submit" variant="primary">Save block</Button>
      </div>
    </form>

    <section class="panel rule-panel">
      <Eyebrow>Planning rules</Eyebrow>
      <h2>AI prompt guardrails</h2>
      <p>
        Morning is reserved for deep work, afternoon for comms and admin, and every generated plan must leave buffer
        instead of filling the whole day.
      </p>
      <div class="rule-list">
        <span>45-90 min blocks</span>
        <span>10-20 min buffer</span>
        <span>High-priority first</span>
        <span>jobs-workflows ready</span>
      </div>
    </section>
  </div>
</main>

<style>
  .focus-page,
  .focus-head,
  .focus-grid,
  .block-form,
  .task-queue,
  .block-stack {
    display: grid;
    gap: 18px;
  }
  .focus-head {
    grid-template-columns: minmax(0, 1fr) max-content;
    align-items: end;
  }
  .focus-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: flex-end;
  }
  .focus-grid {
    grid-template-columns: minmax(260px, 0.85fr) minmax(0, 1.35fr);
  }
  .block-form {
    gap: 14px;
  }
  .block-form-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(140px, 0.45fr);
    gap: 14px;
  }
  .form-actions {
    display: flex;
    justify-content: flex-end;
  }
  .rule-panel {
    display: grid;
    grid-column: 1 / -1;
    align-content: start;
    gap: 16px;
  }
  .rule-panel :global(.eyebrow),
  .rule-panel h2,
  .rule-panel p {
    margin: 0;
  }
  .rule-panel p {
    max-inline-size: 72ch;
  }
  .task-queue,
  .block-stack {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .task-queue li,
  .block-stack li {
    display: grid;
    gap: 12px;
    align-items: start;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-control);
    background: var(--color-surface);
    padding: 13px;
  }
  .task-queue li {
    grid-template-columns: minmax(0, 1fr) max-content;
  }
  .block-stack li {
    grid-template-columns: 96px minmax(0, 1fr) max-content;
  }
  .task-queue div,
  .block-stack div {
    display: grid;
    gap: 3px;
    min-inline-size: 0;
  }
  .task-queue strong,
  .block-stack strong {
    color: var(--color-ink);
  }
  .task-queue span,
  .block-stack span,
  .block-stack time {
    color: var(--color-muted);
    font-size: 0.88rem;
  }
  .block-stack time {
    font-family: var(--font-mono);
  }
  .rule-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
    margin-block-start: 2px;
  }
  .rule-list span {
    display: flex;
    align-items: center;
    min-block-size: 46px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-control);
    background: var(--color-surface-2);
    padding: 12px;
    color: var(--color-ink);
    font-weight: 650;
  }
  @media (max-width: 900px) {
    .focus-head,
    .focus-grid,
    .block-form-grid {
      grid-template-columns: 1fr;
    }
    .focus-actions {
      justify-content: flex-start;
    }
  }
  @media (max-width: 620px) {
    .block-stack li {
      grid-template-columns: 1fr;
    }
  }
</style>
