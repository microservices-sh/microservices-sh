<script lang="ts">
  import { Alert, Badge, Button, Eyebrow, Field } from "$lib/ui";

  let { data, form } = $props();
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
        The upstream OS keeps list and board views close together. This board is backed by the operator-work module so
        humans and AI agents use the same audited task contract.
      </p>
    </div>
    <div class="task-actions">
      <Button href="#new-task" variant="primary">New task</Button>
      <Button href="/app/ai-team">AI intake</Button>
    </div>
  </div>

  {#if form?.error}
    <Alert>{form.error}</Alert>
  {/if}

  {#if data.canManage}
    <form id="new-task" class="panel quick-add" method="POST" action="?/create">
      <div>
        <Eyebrow>Capture</Eyebrow>
        <h2>New task</h2>
      </div>
      <div class="form-grid">
        <Field label="Title" id="task-title">
          <input
            id="task-title"
            name="title"
            required
            maxlength="160"
            autocomplete="off"
            value={form?.values?.title ?? ""}
          />
        </Field>
        <Field label="Category" id="task-category">
          <input
            id="task-category"
            name="category"
            maxlength="80"
            autocomplete="off"
            value={form?.values?.category ?? "Ops"}
          />
        </Field>
        <Field label="Priority" id="task-priority">
          <select id="task-priority" name="priority">
            <option>High</option>
            <option selected>Medium</option>
            <option>Low</option>
          </select>
        </Field>
        <Field label="Due" id="task-due">
          <input
            id="task-due"
            name="dueLabel"
            maxlength="80"
            autocomplete="off"
            value={form?.values?.dueLabel ?? "Today"}
          />
        </Field>
      </div>
      <Field label="Detail" id="task-detail">
        <textarea id="task-detail" name="detail" rows="3" maxlength="1000">{form?.values?.detail ?? ""}</textarea>
      </Field>
      <div class="form-actions">
        <Button type="submit" variant="primary">Save task</Button>
      </div>
    </form>
  {/if}

  <section class="lane-grid" aria-label="Task board">
    {#each data.taskLanes as lane}
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
                <span>{task.dueLabel}</span>
                <span>{task.source}</span>
              </div>
              <ul aria-label={`${task.title} subtasks`}>
                {#each task.subtasks as subtask}
                  <li class:done={subtask.done}>{subtask.done ? "Done" : "Todo"} · {subtask.text}</li>
                {/each}
              </ul>
              {#if data.canManage}
                <div class="task-card-actions">
                  {#if task.status !== "in-progress"}
                    <form method="POST" action="?/status">
                      <input type="hidden" name="taskId" value={task.id} />
                      <input type="hidden" name="status" value="in-progress" />
                      <Button type="submit" size="sm">Start</Button>
                    </form>
                  {/if}
                  {#if task.status !== "done"}
                    <form method="POST" action="?/status">
                      <input type="hidden" name="taskId" value={task.id} />
                      <input type="hidden" name="status" value="done" />
                      <Button type="submit" size="sm" variant="primary">Done</Button>
                    </form>
                  {/if}
                  {#if task.status === "done"}
                    <form method="POST" action="?/status">
                      <input type="hidden" name="taskId" value={task.id} />
                      <input type="hidden" name="status" value="todo" />
                      <Button type="submit" size="sm">Reopen</Button>
                    </form>
                  {/if}
                </div>
              {/if}
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
  .quick-add,
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
  .quick-add {
    gap: 14px;
  }
  .quick-add h2 {
    margin: 0;
  }
  .form-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) repeat(3, minmax(120px, 0.5fr));
    gap: 14px;
  }
  .form-actions,
  .task-card-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .form-actions {
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
  .task-card-actions {
    padding-block-start: 2px;
  }
  .empty-lane {
    color: var(--color-muted);
  }
  @media (max-width: 980px) {
    .task-head,
    .form-grid,
    .lane-grid {
      grid-template-columns: 1fr;
    }
    .task-actions {
      justify-content: flex-start;
    }
  }
</style>
