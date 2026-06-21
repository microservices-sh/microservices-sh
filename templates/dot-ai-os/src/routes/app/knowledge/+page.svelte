<script lang="ts">
  import { Alert, Badge, Button, Eyebrow, Field } from "$lib/ui";
  import { knowledgeItems, knowledgeStages } from "$lib/os-data";

  let { data, form } = $props();
</script>

<svelte:head>
  <title>Knowledge log · DOT AI OS</title>
</svelte:head>

<main class="section knowledge-page">
  <div class="knowledge-head">
    <div>
      <Eyebrow>Knowledge log</Eyebrow>
      <h1>Turn work traces into reusable context.</h1>
      <p>
        Capture sources, digest the useful learning, then promote the item into output. Provider ingestion stays
        approval-gated instead of hidden in the template.
      </p>
    </div>
    {#if data.canManage}
      <form class="import-bar" method="POST" action="?/create" aria-label="Knowledge capture">
        <Field label="Title" id="knowledge-title">
          <input
            id="knowledge-title"
            name="title"
            required
            maxlength="200"
            autocomplete="off"
            value={form?.values?.title ?? ""}
          />
        </Field>
        <Field label="Source URL" id="knowledge-url">
          <input
            id="knowledge-url"
            name="sourceUrl"
            inputmode="url"
            placeholder="https://..."
            value={form?.values?.sourceUrl ?? ""}
          />
        </Field>
        <Field label="Reusable context" id="knowledge-content">
          <textarea id="knowledge-content" name="content" rows="4" required minlength="20">{form?.values?.content ?? ""}</textarea>
        </Field>
        <div class="form-actions">
          <Button type="submit" variant="primary">Save article</Button>
        </div>
      </form>
    {/if}
  </div>

  {#if form?.error}
    <Alert>{form.error}</Alert>
  {:else if form?.created}
    <Alert tone="success">Article saved.</Alert>
  {/if}

  <section class="panel module-panel">
    <div class="section-head">
      <div>
        <Eyebrow>Knowledge articles</Eyebrow>
        <h2>{data.articles.length} saved articles</h2>
      </div>
      <Badge tone="neutral">knowledge-base-rag</Badge>
    </div>
    <div class="article-stack">
      {#each data.articles as article}
        <article>
          <div>
            <strong>{article.title}</strong>
            <span>{article.updatedLabel} · {article.wordCount} words · {article.sourceType}</span>
          </div>
          <p>{article.excerpt}</p>
          {#if article.sourceUrl}
            <a href={article.sourceUrl} target="_blank" rel="noreferrer">Source</a>
          {/if}
        </article>
      {:else}
        <p class="empty-stage">No saved articles yet.</p>
      {/each}
    </div>
  </section>

  <div class="knowledge-grid">
    {#each knowledgeStages as stage}
      <section class="panel stage-panel" aria-label={stage.label}>
        <div class="stage-head">
          <div>
            <Eyebrow>{stage.label}</Eyebrow>
            <h2>{stage.items.length}</h2>
          </div>
          <Badge tone="neutral">{stage.id}</Badge>
        </div>
        <div class="stage-stack">
          {#each stage.items as item}
            <article>
              <div>
                <strong>{item.title}</strong>
                <span>{item.source}</span>
              </div>
              <p>{item.summary}</p>
              <div class="tag-row">
                {#each item.tags as tag}
                  <Badge>{tag}</Badge>
                {/each}
              </div>
            </article>
          {:else}
            <p class="empty-stage">No items in this lane.</p>
          {/each}
        </div>
      </section>
    {/each}
  </div>

  <section class="panel">
    <div class="section-head">
      <div>
        <Eyebrow>Source inventory</Eyebrow>
        <h2>{knowledgeItems.length} starter records</h2>
      </div>
      <Button href="/app/content" size="sm">Create content</Button>
    </div>
    <p>
      The upstream app supports Threads, Instagram, Facebook, X, articles, transcript files, and local vault imports.
      This template keeps the UI contract visible and waits for an ingestion module before adding provider secrets.
    </p>
  </section>
</main>

<style>
  .knowledge-page,
  .knowledge-head,
  .knowledge-grid,
  .module-panel,
  .article-stack,
  .stage-stack,
  .tag-row {
    display: grid;
    gap: 18px;
  }
  .knowledge-head {
    grid-template-columns: minmax(0, 1fr) minmax(300px, 420px);
    align-items: end;
  }
  .import-bar {
    display: grid;
    gap: 0;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-card);
    background: var(--color-surface);
    padding: 16px;
  }
  .knowledge-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .form-actions {
    display: flex;
    justify-content: flex-end;
  }
  .article-stack article {
    display: grid;
    gap: 8px;
    border-block-start: 1px solid var(--color-line);
    padding-block: 14px;
  }
  .article-stack article:first-child {
    border-block-start: 0;
    padding-block-start: 0;
  }
  .article-stack article > div {
    display: grid;
    gap: 2px;
  }
  .article-stack strong {
    color: var(--color-ink);
  }
  .article-stack span,
  .article-stack a {
    color: var(--color-muted);
    font-size: 0.88rem;
  }
  .article-stack p {
    margin: 0;
  }
  .stage-head {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 12px;
  }
  .stage-head h2 {
    margin: 0;
  }
  .stage-stack article {
    display: grid;
    gap: 10px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-control);
    background: var(--color-surface);
    padding: 14px;
  }
  .stage-stack article > div:first-child {
    display: grid;
    gap: 2px;
  }
  .stage-stack strong {
    color: var(--color-ink);
  }
  .stage-stack span,
  .empty-stage {
    color: var(--color-muted);
    font-size: 0.88rem;
  }
  .stage-stack p {
    margin: 0;
  }
  .tag-row {
    grid-template-columns: repeat(auto-fit, minmax(70px, max-content));
    gap: 6px;
  }
  @media (max-width: 980px) {
    .knowledge-head,
    .knowledge-grid {
      grid-template-columns: 1fr;
    }
  }
  @media (max-width: 620px) {
    .form-actions {
      justify-content: stretch;
    }
    .form-actions :global(a),
    .form-actions :global(button) {
      width: 100%;
    }
  }
</style>
