<script lang="ts">
  import { Badge, Card, EmptyState, PageHeader } from "$lib/ui";
  import type { Tone } from "$lib/ui/types";

  let { data } = $props();

  function statusTone(status: string): Tone {
    switch (status) {
      case "completed":
        return "good";
      case "in progress":
        return "warn";
      case "on hold":
        return "bad";
      default:
        return "info";
    }
  }

  function kb(bytes: number): string {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
</script>

<svelte:head>
  <title>{data.project.title} | Project Update</title>
</svelte:head>

<main class="public-project">
  <PageHeader
    eyebrow={data.company.name}
    title={data.project.title}
    description={data.project.description ?? "Project progress snapshot."}
  >
    {#snippet meta()}
      <Badge tone={statusTone(data.project.status)}>{data.project.status}</Badge>
      {#if data.project.location}<span>{data.project.location}</span>{/if}
      {#if data.project.updated}<span>Updated {data.project.updated}</span>{/if}
    {/snippet}
  </PageHeader>

  <div class="summary">
    <Card title="Schedule">
      <dl class="detail-list">
        <div><dt>Start</dt><dd>{data.project.startDate ?? "Not set"}</dd></div>
        <div><dt>Expected end</dt><dd>{data.project.expectedEndDate ?? "Not set"}</dd></div>
        <div><dt>Actual end</dt><dd>{data.project.actualEndDate ?? "Not set"}</dd></div>
      </dl>
    </Card>
  </div>

  <Card title="Progress timeline">
    {#if data.timeline.length > 0}
      <ol class="timeline">
        {#each data.timeline as entry (entry.id)}
          <li>
            <div class="timeline__head">
              <div>
                <Badge tone="info">{entry.category}</Badge>
                <strong>{entry.description ?? "Progress update"}</strong>
              </div>
              <span>{entry.captured}</span>
            </div>
            {#if entry.media.length > 0}
              <ul class="media-list" role="list">
                {#each entry.media as media (media.id)}
                  <li>
                    <Badge tone="neutral">{media.fileType}</Badge>
                    <span>{media.mimeType}</span>
                    <span>{kb(media.fileSizeBytes)}</span>
                  </li>
                {/each}
              </ul>
            {/if}
            {#if entry.comments.length > 0}
              <ol class="comments">
                {#each entry.comments as comment (comment.id)}
                  <li>
                    <strong>{comment.authorName}</strong>
                    <span>{comment.created}</span>
                    <p>{comment.content}</p>
                  </li>
                {/each}
              </ol>
            {/if}
          </li>
        {/each}
      </ol>
    {:else}
      <EmptyState title="No updates yet" description="Progress updates will appear here after the team posts them." />
    {/if}
  </Card>
</main>

<style>
  .public-project {
    width: min(100% - 32px, 980px);
    margin-inline: auto;
    padding-block: 32px 56px;
    display: grid;
    gap: 18px;
  }
  .summary {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }
  .timeline,
  .comments,
  .media-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .timeline {
    display: grid;
    gap: 14px;
  }
  .timeline > li {
    display: grid;
    gap: 12px;
    padding-block-end: 14px;
    border-block-end: 1px solid var(--color-line);
  }
  .timeline > li:last-child {
    border-block-end: 0;
    padding-block-end: 0;
  }
  .timeline__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }
  .timeline__head > div {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .timeline__head span,
  .comments span {
    color: var(--color-ink-faint);
    font-size: 0.84rem;
  }
  .media-list,
  .comments {
    display: grid;
    gap: 8px;
  }
  .media-list li,
  .comments li {
    border: 1px solid var(--color-line);
    border-radius: var(--radius-sm);
    padding: 10px;
  }
  .media-list li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    color: var(--color-ink-soft);
  }
  .comments li {
    display: grid;
    gap: 4px;
  }
  .comments p {
    margin: 0;
    white-space: pre-wrap;
  }
  @media (max-width: 640px) {
    .public-project {
      width: min(100% - 20px, 980px);
      padding-block-start: 20px;
    }
    .timeline__head {
      display: grid;
    }
  }
</style>
