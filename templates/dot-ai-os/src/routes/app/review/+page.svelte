<script lang="ts">
  import { Alert, Badge, Button, Eyebrow, Field } from "$lib/ui";
  import { reviewPrompts } from "$lib/os-data";

  let { data, form } = $props();

  const fallbackShipped = data.completedTasks[0]?.title ?? "Saved work packet";
  const markdownLines = data.latestReview?.markdown?.split("\n") ?? [
    "## Shipped",
    `- ${fallbackShipped}`,
    "## Open loops",
    "- Route one content item to AI team.",
    "## Tomorrow first move",
    "- Start with the highest-friction task before inbox."
  ];
</script>

<svelte:head>
  <title>Daily review · DOT AI OS</title>
</svelte:head>

<main class="section review-page">
  <div class="review-head">
    <div>
      <Eyebrow>Daily review</Eyebrow>
      <h1>Close the loop before the work disappears.</h1>
      <p>
        The upstream OS treats review as an unlock: only saved notes become durable context for tomorrow's tasks,
        handoffs, and knowledge.
      </p>
    </div>
    <div class="review-lock">
      <span>Unlock state</span>
      <strong>{data.latestReview ? "Saved today" : "Draft ready"}</strong>
      <Button href="#daily-review-form" variant="primary" size="sm">Save and unlock</Button>
    </div>
  </div>

  {#if form?.error}
    <Alert>{form.error}</Alert>
  {/if}

  <div class="review-grid">
    <section class="panel">
      <div class="section-head">
        <div>
          <Eyebrow>Check-in</Eyebrow>
          <h2>Prompt stack</h2>
        </div>
        <Button size="sm">AI rewrite</Button>
      </div>
      <ol class="prompt-list">
        {#each reviewPrompts as prompt, index}
          <li>
            <span>{index + 1}</span>
            <p>{prompt}</p>
          </li>
        {/each}
      </ol>
    </section>

    <section class="panel review-editor-card">
      <div class="section-head">
        <div>
          <Eyebrow>Daily note</Eyebrow>
          <h2>Obsidian-ready shape</h2>
        </div>
        <Badge tone="neutral">operator-work D1</Badge>
      </div>
      <form id="daily-review-form" class="review-form" method="POST" action="?/save">
        <input type="hidden" name="date" value={data.date} />
        <Field label="Shipped" id="review-shipped">
          <textarea id="review-shipped" name="shipped" rows="4" maxlength="4000">{data.latestReview?.shipped ?? `- ${fallbackShipped}`}</textarea>
        </Field>
        <Field label="Open loops" id="review-open-loops">
          <textarea id="review-open-loops" name="openLoops" rows="4" maxlength="4000">{data.latestReview?.openLoops ?? "- Route one content item to AI team."}</textarea>
        </Field>
        <Field label="Agent handoffs" id="review-agent-handoffs">
          <textarea id="review-agent-handoffs" name="agentHandoffs" rows="3" maxlength="4000">{data.latestReview?.agentHandoffs ?? "- Ask the AI team to prepare the next brief."}</textarea>
        </Field>
        <Field label="Tomorrow first move" id="review-first-move">
          <input
            id="review-first-move"
            name="tomorrowFirstMove"
            required
            maxlength="1000"
            autocomplete="off"
            value={data.latestReview?.tomorrowFirstMove ?? "Start with the highest-friction task before inbox."}
          />
        </Field>
        <div class="form-actions">
          <Button type="submit" variant="primary">Save review</Button>
        </div>
      </form>
      <div class="section-head preview-head">
        <div>
          <Eyebrow>Markdown output</Eyebrow>
          <h2>Latest saved shape</h2>
        </div>
      </div>
      <div class="markdown-preview">
        {#each markdownLines as line}
          <p>{line || " "}</p>
        {/each}
      </div>
    </section>

    <section class="panel">
      <Eyebrow>Signals</Eyebrow>
      <h2>Review health</h2>
      <div class="signal-grid">
        {#each data.reviewSignals as signal}
          <div>
            <span>{signal.label}</span>
            <strong>{signal.value}</strong>
            <Badge tone={signal.tone}>{signal.tone}</Badge>
          </div>
        {/each}
      </div>
    </section>
  </div>
</main>

<style>
  .review-page,
  .review-head,
  .review-grid,
  .review-form,
  .prompt-list,
  .signal-grid {
    display: grid;
    gap: 18px;
  }
  .review-head {
    grid-template-columns: minmax(0, 1fr) minmax(240px, 320px);
    align-items: stretch;
  }
  .review-lock {
    display: grid;
    align-content: start;
    gap: 10px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-card);
    background: var(--color-surface);
    padding: 18px;
    box-shadow: var(--shadow-card);
  }
  .review-lock span,
  .signal-grid span {
    color: var(--color-muted);
    font-size: 0.78rem;
    font-weight: 650;
    text-transform: uppercase;
  }
  .review-lock strong,
  .signal-grid strong {
    color: var(--color-ink);
    font-size: 1.12rem;
  }
  .review-grid {
    grid-template-columns: minmax(0, 1fr) minmax(320px, 0.85fr);
  }
  .review-editor-card {
    grid-row: span 2;
  }
  .review-form {
    gap: 12px;
  }
  .form-actions {
    display: flex;
    justify-content: flex-end;
  }
  .preview-head {
    margin-block-start: 4px;
  }
  .prompt-list {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .prompt-list li {
    display: grid;
    grid-template-columns: 32px minmax(0, 1fr);
    gap: 12px;
    align-items: start;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-control);
    padding: 12px;
  }
  .prompt-list span {
    display: grid;
    place-items: center;
    inline-size: 28px;
    aspect-ratio: 1;
    border-radius: 8px;
    background: var(--color-accent-soft);
    color: var(--color-accent-strong);
    font-family: var(--font-mono);
    font-size: 0.75rem;
  }
  .prompt-list p {
    margin: 0;
    color: var(--color-ink);
  }
  .markdown-preview {
    display: grid;
    gap: 10px;
    min-block-size: 320px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-control);
    background: var(--color-surface-2);
    padding: 16px;
    font-family: var(--font-mono);
    font-size: 0.86rem;
  }
  .markdown-preview p {
    margin: 0;
    max-inline-size: none;
  }
  .signal-grid {
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  }
  .signal-grid div {
    display: grid;
    gap: 6px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-control);
    padding: 12px;
  }
  @media (max-width: 900px) {
    .review-head,
    .review-grid {
      grid-template-columns: 1fr;
    }
    .review-editor-card {
      grid-row: auto;
    }
  }
</style>
