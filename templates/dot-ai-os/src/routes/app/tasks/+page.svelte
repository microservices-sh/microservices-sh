<script lang="ts">
  import { Badge, Button, Eyebrow } from "$lib/ui";
  import { taskLanes } from "$lib/os-data";
</script>

<svelte:head>
  <title>Tasks · DOT AI OS</title>
</svelte:head>

<main class="section tasks-page">
  <div class="task-head">
    <div>
      <Eyebrow>Tasks</Eyebrow>
      <h1>Route loose work into visible lanes.</h1>
      <p>
        The upstream OS keeps list and board views close together. This starter board shows the contract for future
        task persistence without coupling the template to a Vercel, Express, or SQLite backend.
      </p>
    </div>
    <div class="task-actions">
      <Button variant="primary">New task</Button>
      <Button>AI intake</Button>
    </div>
  </div>

  <section class="lane-grid" aria-label="Task board">
    {#each taskLanes as lane}
      <div class="panel lane">
        <div class="lane-head">
          <div>
            <Eyebrow>{lane.label}</Eyebrow>
            <h2>{lane.tasks.length}</h2>
          </div>
          <Badge tone="neutral">{lane.id}</Badge>
        </div>
        <div class="task-stack">
          {#each lane.tasks as task}
            <article>
              <div class="task-card-head">
                <strong>{task.title}</strong>
                <Badge tone={task.priority === "High" ? "warn" : "neutral"}>{task.priority}</Badge>
              </div>
              <p>{task.detail}</p>
              <div class="task-meta">
                <span>{task.category}</span>
                <span>{task.due}</span>
                <span>{task.source}</span>
              </div>
              <ul aria-label={`${task.title} subtasks`}>
                {#each task.subtasks as subtask}
                  <li class:done={subtask.done}>{subtask.done ? "Done" : "Todo"} · {subtask.text}</li>
                {/each}
              </ul>
            </article>
          {:else}
            <p class="empty-lane">Nothing here.</p>
          {/each}
        </div>
      </div>
    {/each}
  </section>
</main>

<style>
  .tasks-page,
  .task-head,
  .lane-grid,
  .task-stack {
    display: grid;
    gap: 18px;
  }
  .task-head {
    grid-template-columns: minmax(0, 1fr) max-content;
    align-items: end;
  }
  .task-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: flex-end;
  }
  .lane-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-items: start;
  }
  .lane {
    display: grid;
    gap: 14px;
    padding: 16px;
  }
  .lane-head,
  .task-card-head,
  .task-meta {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 10px;
  }
  .lane-head h2 {
    margin: 0;
  }
  .task-stack article {
    display: grid;
    gap: 10px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-control);
    background: var(--color-surface);
    padding: 14px;
  }
  .task-stack strong {
    color: var(--color-ink);
  }
  .task-stack p {
    margin: 0;
  }
  .task-meta {
    justify-content: flex-start;
    flex-wrap: wrap;
  }
  .task-meta span {
    border: 1px solid var(--color-line);
    border-radius: 999px;
    padding: 3px 8px;
    color: var(--color-muted);
    font-size: 0.76rem;
  }
  .task-stack ul {
    display: grid;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .task-stack li {
    color: var(--color-muted);
    font-size: 0.84rem;
  }
  .task-stack li.done {
    color: var(--color-success);
  }
  .empty-lane {
    color: var(--color-muted);
  }
  @media (max-width: 980px) {
    .task-head,
    .lane-grid {
      grid-template-columns: 1fr;
    }
    .task-actions {
      justify-content: flex-start;
    }
  }
</style>
