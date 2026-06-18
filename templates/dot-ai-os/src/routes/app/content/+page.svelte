<script lang="ts">
  import { Badge, Button, Eyebrow } from "$lib/ui";
  import { contentItems, contentStages, knowledgeItems } from "$lib/os-data";
</script>

<svelte:head>
  <title>Content pipeline · DOT AI OS</title>
</svelte:head>

<main class="section content-page">
  <div class="content-head">
    <div>
      <Eyebrow>Content pipeline</Eyebrow>
      <h1>Promote knowledge into output.</h1>
      <p>
        The upstream OS connects knowledge capture to IP production. This starter surface keeps the workflow visible:
        source, angle, platform, format, schedule, and publish link.
      </p>
    </div>
    <div class="content-metrics">
      <div><span>Items</span><strong>{contentItems.length}</strong></div>
      <div><span>Sources</span><strong>{knowledgeItems.length}</strong></div>
    </div>
  </div>

  <section class="panel inspiration-panel">
    <div class="section-head">
      <div>
        <Eyebrow>Weekly inspiration radar</Eyebrow>
        <h2>Candidate angles</h2>
      </div>
      <Button size="sm">Generate brief</Button>
    </div>
    <div class="suggestion-list">
      {#each contentItems as item, index}
        <article>
          <span>{index + 1}</span>
          <div>
            <strong>{item.title}</strong>
            <p>{item.angle}</p>
          </div>
          <Badge tone={item.status === "draft" ? "info" : "neutral"}>{item.platform}</Badge>
        </article>
      {/each}
    </div>
  </section>

  <section class="pipeline-grid" aria-label="Content status lanes">
    {#each contentStages as stage}
      <div class="panel stage">
        <div class="stage-head">
          <div>
            <Eyebrow>{stage.label}</Eyebrow>
            <h2>{stage.items.length}</h2>
          </div>
          <Badge>{stage.id}</Badge>
        </div>
        <div class="stage-list">
          {#each stage.items as item}
            <article>
              <strong>{item.title}</strong>
              <span>{item.platform} · {item.due}</span>
              <p>{item.angle}</p>
            </article>
          {:else}
            <p class="empty-stage">No items in this lane.</p>
          {/each}
        </div>
      </div>
    {/each}
  </section>
</main>

<style>
  .content-page,
  .content-head,
  .pipeline-grid,
  .suggestion-list,
  .stage-list {
    display: grid;
    gap: 18px;
  }
  .content-head {
    grid-template-columns: minmax(0, 1fr) minmax(220px, 300px);
    align-items: end;
  }
  .content-metrics {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
  .content-metrics div {
    display: grid;
    gap: 4px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-card);
    background: var(--color-surface);
    padding: 14px;
  }
  .content-metrics span,
  .stage-list span {
    color: var(--color-muted);
    font-size: 0.82rem;
  }
  .content-metrics strong {
    color: var(--color-ink);
    font-size: 1.4rem;
  }
  .suggestion-list article {
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr) max-content;
    gap: 12px;
    align-items: start;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-control);
    padding: 12px;
  }
  .suggestion-list article > span {
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
  .suggestion-list p,
  .stage-list p {
    margin: 0;
  }
  .suggestion-list strong,
  .stage-list strong {
    color: var(--color-ink);
  }
  .pipeline-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .stage {
    display: grid;
    gap: 14px;
    padding: 16px;
  }
  .stage-head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }
  .stage-head h2 {
    margin: 0;
  }
  .stage-list article {
    display: grid;
    gap: 6px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-control);
    background: var(--color-surface);
    padding: 12px;
  }
  .empty-stage {
    color: var(--color-muted);
  }
  @media (max-width: 1080px) {
    .pipeline-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (max-width: 720px) {
    .content-head,
    .pipeline-grid,
    .suggestion-list article {
      grid-template-columns: 1fr;
    }
  }
</style>
