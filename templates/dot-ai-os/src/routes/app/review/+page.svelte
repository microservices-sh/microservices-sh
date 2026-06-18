<script lang="ts">
  import { Badge, Button, Eyebrow } from "$lib/ui";
  import { completedTasks, reviewPrompts, reviewSignals } from "$lib/os-data";
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
      <strong>Draft ready</strong>
      <Button variant="primary" size="sm">Save and unlock</Button>
    </div>
  </div>

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
          <Eyebrow>Markdown output</Eyebrow>
          <h2>Obsidian-ready shape</h2>
        </div>
        <Badge tone="neutral">template-owned D1 later</Badge>
      </div>
      <div class="markdown-preview">
        <p>## Shipped</p>
        <p>- {completedTasks[0]?.title ?? "Saved work packet"}</p>
        <p>## Open loops</p>
        <p>- Route one content item to AI team.</p>
        <p>## Tomorrow first move</p>
        <p>- Start with the highest-friction task before inbox.</p>
      </div>
    </section>

    <section class="panel">
      <Eyebrow>Signals</Eyebrow>
      <h2>Review health</h2>
      <div class="signal-grid">
        {#each reviewSignals as signal}
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
