<script lang="ts">
  import { enhance } from "$app/forms";
  import { Alert, Badge, Button, Card, EmptyState, Field, FormActions, PageHeader } from "$lib/ui";
  import type { Tone } from "$lib/ui/types";

  let { data, form } = $props();
  const project = $derived(data.project);
  let submitting = $state<string | null>(null);

  function enhanceNamed(name: string) {
    submitting = name;
    return async ({ update }: { update: () => Promise<void> }) => {
      submitting = null;
      await update();
    };
  }

  function statusTone(status: string): Tone {
    switch (status) {
      case "completed":
        return "good";
      case "in_progress":
        return "warn";
      case "on_hold":
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
  <title>{project.title} | Project Progress | ERP Shell</title>
</svelte:head>

<main class="section project-detail-page">
  <PageHeader eyebrow="Project progress" title={project.title} description={project.description ?? "Customer-facing progress timeline."}>
    {#snippet actions()}
      <Button href="/app/project-progress" variant="ghost">Back to projects</Button>
    {/snippet}
    {#snippet meta()}
      <Badge tone={statusTone(project.status)}>{project.statusLabel}</Badge>
      <a href={`/app/customers/${project.customerId}`}>{project.customerName}</a>
      {#if project.location}<span>{project.location}</span>{/if}
    {/snippet}
  </PageHeader>

  {#if form?.projectStatusUpdated}
    <Alert tone="success">Project status updated.</Alert>
  {:else if form?.logAdded}
    <Alert tone="success">Progress update added.</Alert>
  {:else if form?.commentAdded}
    <Alert tone="success">Comment added.</Alert>
  {:else if form?.accessGranted}
    <Alert tone="success">Access granted.</Alert>
  {:else if form?.accessRevoked}
    <Alert tone="success">Access revoked.</Alert>
  {:else if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <div class="grid">
    <section class="grid__main">
      <Card title="Timeline">
        {#if data.timeline.length > 0}
          <ol class="timeline">
            {#each data.timeline as entry (entry.log.id)}
              <li>
                <div class="timeline__head">
                  <div>
                    <Badge tone="info">{entry.log.category}</Badge>
                    <strong>{entry.log.description ?? "Progress update"}</strong>
                  </div>
                  <span>{entry.log.captured}</span>
                </div>
                <dl class="mini-list">
                  <div><dt>Uploader</dt><dd>{entry.log.uploaderId}</dd></div>
                  <div><dt>Captured</dt><dd>{entry.log.capturedAt}</dd></div>
                  <div><dt>Media</dt><dd>{entry.media.length}</dd></div>
                </dl>

                {#if entry.media.length > 0}
                  <ul class="media-list" role="list">
                    {#each entry.media as media (media.id)}
                      <li>
                        <Badge tone="neutral">{media.fileType}</Badge>
                        <span>{media.mimeType}</span>
                        <span>{kb(media.fileSizeBytes)}</span>
                        {#if media.dimensions}<span>{media.dimensions}</span>{/if}
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

                {#if data.canManage}
                  <form class="inline-comment" method="POST" action="?/addComment" use:enhance={() => enhanceNamed("comment")}>
                    <input type="hidden" name="logId" value={entry.log.id} />
                    <Field label="Comment on this update" id={`comment-${entry.log.id}`}>
                      <textarea id={`comment-${entry.log.id}`} name="content" rows="2"></textarea>
                    </Field>
                    <Button type="submit" size="sm" variant="ghost">Add comment</Button>
                  </form>
                {/if}
              </li>
            {/each}
          </ol>
        {:else}
          <EmptyState title="No progress updates" description="Add the first milestone or field update for this project." />
        {/if}
      </Card>

      <Card title="Project comments">
        {#if data.comments.length > 0}
          <ol class="comments comments--standalone">
            {#each data.comments as comment (comment.id)}
              <li>
                <strong>{comment.authorName}</strong>
                <span>{comment.created}</span>
                <p>{comment.content}</p>
              </li>
            {/each}
          </ol>
        {:else}
          <EmptyState title="No project comments" description="General project comments will appear here." />
        {/if}
      </Card>
    </section>

    <aside class="grid__side">
      <Card title="Project summary">
        <dl class="detail-list">
          <div><dt>Customer</dt><dd><a href={`/app/customers/${project.customerId}`}>{project.customerName}</a></dd></div>
          <div><dt>Status</dt><dd><Badge tone={statusTone(project.status)}>{project.statusLabel}</Badge></dd></div>
          <div><dt>Start</dt><dd>{project.startDate ?? "Not set"}</dd></div>
          <div><dt>Expected end</dt><dd>{project.expectedEndDate ?? "Not set"}</dd></div>
          <div><dt>Actual end</dt><dd>{project.actualEndDate ?? "Not set"}</dd></div>
          <div><dt>Updated</dt><dd>{project.updated || "just now"}</dd></div>
        </dl>
      </Card>

      <Card title="Public snapshot" class="stack">
        <p class="muted">Treat this URL as a bearer secret. The public page is read-only and hides raw storage keys.</p>
        <a class="public-link" href={project.publicPath}>{project.publicUrl}</a>
      </Card>

      {#if data.canManage}
        <Card title="Update status">
          <form method="POST" action="?/updateStatus" use:enhance={() => enhanceNamed("status")}>
            <Field label="Status" id="project-status">
              <select id="project-status" name="status">
                {#each data.statusOptions as option (option.value)}
                  <option value={option.value} selected={project.status === option.value}>{option.label}</option>
                {/each}
              </select>
            </Field>
            <Field label="Actual end date" id="actual-end" hint="Optional, used when completed">
              <input id="actual-end" name="actualEndDate" type="date" value={project.actualEndDate ?? ""} />
            </Field>
            <FormActions submitLabel="Save status" submittingLabel="Saving..." submitting={submitting === "status"} />
          </form>
        </Card>

        <Card title="Add progress update">
          <form method="POST" action="?/addLog" use:enhance={() => enhanceNamed("log")}>
            <Field label="Category" id="progress-category">
              <select id="progress-category" name="category">
                {#each data.categoryOptions as option (option.value)}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>
            </Field>
            <Field label="Captured at" id="captured-at" hint="Optional ISO or date">
              <input id="captured-at" name="capturedAt" />
            </Field>
            <Field label="Update" id="progress-description" required>
              <textarea id="progress-description" name="description" rows="4" required></textarea>
            </Field>
            <FormActions submitLabel="Add update" submittingLabel="Adding..." submitting={submitting === "log"} />
          </form>
        </Card>

        <Card title="Access grants" class="stack">
          {#if data.access.length > 0}
            <ul class="access-list" role="list">
              {#each data.access as grant (grant.id)}
                <li>
                  <div>
                    <strong>{grant.userId}</strong>
                    <span>{grant.created}</span>
                  </div>
                  <div class="grant-flags">
                    <Badge tone={grant.canView ? "good" : "neutral"}>{grant.canView ? "view" : "no view"}</Badge>
                    <Badge tone={grant.canUpload ? "warn" : "neutral"}>{grant.canUpload ? "upload" : "read only"}</Badge>
                  </div>
                  <form method="POST" action="?/revokeAccess" use:enhance={() => enhanceNamed("access")}>
                    <input type="hidden" name="userId" value={grant.userId} />
                    <Button type="submit" size="sm" variant="ghost">Revoke</Button>
                  </form>
                </li>
              {/each}
            </ul>
          {:else}
            <p class="muted">No worker access grants yet.</p>
          {/if}

          <form method="POST" action="?/grantAccess" use:enhance={() => enhanceNamed("access")}>
            <Field label="Worker or member id" id="grant-user" required>
              <input id="grant-user" name="userId" required placeholder="worker:demo" />
            </Field>
            <fieldset class="checks">
              <legend>Permissions</legend>
              <label><input type="checkbox" name="canView" checked /> View</label>
              <label><input type="checkbox" name="canUpload" checked /> Upload metadata</label>
            </fieldset>
            <Button type="submit" variant="primary">Grant access</Button>
          </form>
        </Card>
      {/if}
    </aside>
  </div>
</main>

<style>
  .grid {
    display: grid;
    gap: 18px;
    grid-template-columns: minmax(0, 1.55fr) minmax(300px, 0.85fr);
    align-items: start;
  }
  .grid__main,
  .grid__side {
    display: grid;
    gap: 16px;
    min-inline-size: 0;
  }
  @media (max-width: 980px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
  .timeline,
  .comments,
  .access-list,
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
    padding-block-end: 0;
    border-block-end: 0;
  }
  .timeline__head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
  }
  .timeline__head > div {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  .timeline__head span,
  .muted {
    color: var(--color-ink-soft);
  }
  .mini-list {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    margin: 0;
  }
  .mini-list div {
    padding: 10px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-sm);
  }
  .mini-list dt {
    font-size: 0.74rem;
    color: var(--color-ink-faint);
  }
  .mini-list dd {
    margin: 3px 0 0;
    overflow-wrap: anywhere;
  }
  .media-list,
  .comments,
  .access-list {
    display: grid;
    gap: 8px;
  }
  .media-list li,
  .comments li,
  .access-list li {
    border: 1px solid var(--color-line);
    border-radius: var(--radius-sm);
    padding: 10px;
  }
  .media-list li {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    color: var(--color-ink-soft);
  }
  .comments li {
    display: grid;
    gap: 4px;
  }
  .comments span,
  .access-list span {
    color: var(--color-ink-faint);
    font-size: 0.8rem;
  }
  .comments p {
    margin: 0;
    color: var(--color-ink);
    white-space: pre-wrap;
  }
  .inline-comment {
    display: grid;
    gap: 8px;
  }
  .public-link {
    display: block;
    overflow-wrap: anywhere;
    color: var(--color-act);
  }
  .access-list li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 10px;
    align-items: center;
  }
  .grant-flags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .checks {
    display: grid;
    gap: 8px;
    margin: 0 0 14px;
    padding: 0;
    border: 0;
  }
  .checks legend {
    margin-block-end: 6px;
    font-size: 0.84rem;
    font-weight: 600;
  }
  .checks label {
    display: flex;
    min-block-size: 36px;
    align-items: center;
    gap: 8px;
  }
  @media (max-width: 640px) {
    .mini-list,
    .access-list li {
      grid-template-columns: 1fr;
    }
  }
</style>
