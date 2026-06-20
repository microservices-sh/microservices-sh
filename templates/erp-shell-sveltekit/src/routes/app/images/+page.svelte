<script lang="ts">
  import { enhance } from "$app/forms";
  import { Card, PageHeader, Badge, Button, Field, Alert } from "$lib/ui";

  let { data, form } = $props();
  let generating = $state(false);

  const when = (iso: string) => new Date(iso).toLocaleString();
</script>

<svelte:head>
  <title>Images · ERP Shell</title>
</svelte:head>

<main class="section">
  <PageHeader
    eyebrow="AI image studio"
    title="Images"
    description="Generate and manage images for your company, powered by the image-generation module."
  />

  {#if form?.generated}
    <Alert tone="success">Image generated.</Alert>
  {:else if form?.deleted}
    <Alert tone="success">Image deleted.</Alert>
  {:else if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  {#if data.canManage}
    <Card class="mt-6">
      <h2>Generate</h2>
      <form
        method="POST"
        action="?/generate"
        use:enhance={() => {
          generating = true;
          return async ({ update }) => {
            generating = false;
            await update();
          };
        }}
      >
        <Field label="Prompt" id="prompt">
          <input id="prompt" name="prompt" required placeholder="A minimalist logo for a coffee roastery, flat vector" />
        </Field>
        <div class="img-row">
          <Field label="Aspect ratio" id="aspectRatio">
            <select id="aspectRatio" name="aspectRatio">
              <option value="1:1">Square (1:1)</option>
              <option value="16:9">Wide (16:9)</option>
              <option value="9:16">Tall (9:16)</option>
            </select>
          </Field>
          <Button type="submit" variant="primary" disabled={generating}>{generating ? "Generating…" : "Generate"}</Button>
        </div>
      </form>
    </Card>
  {/if}

  <Card class="mt-6">
    <h2>Gallery</h2>
    {#if data.images.length > 0}
      <div class="img-grid">
        {#each data.images as img}
          <figure class="img-cell">
            {#if img.status === "active"}
              <img src={`/app/images/${img.id}`} alt={img.prompt} loading="lazy" />
            {:else}
              <div class="img-ph"><Badge tone="neutral">{img.status}</Badge></div>
            {/if}
            <figcaption>
              <span class="img-prompt" title={img.prompt}>{img.prompt}</span>
              <span class="img-meta">{when(img.createdAt)}</span>
              {#if data.canManage}
                <form method="POST" action="?/delete" use:enhance>
                  <input type="hidden" name="imageId" value={img.id} />
                  <Button type="submit" variant="ghost" size="sm">Delete</Button>
                </form>
              {/if}
            </figcaption>
          </figure>
        {/each}
      </div>
    {:else}
      <p class="empty">No images yet. Generate your first one above.</p>
    {/if}
  </Card>
</main>

<style>
  .img-row {
    display: flex;
    align-items: end;
    gap: 12px;
  }
  .img-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 14px;
  }
  .img-cell {
    margin: 0;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    overflow: hidden;
    background: var(--color-panel-subtle);
  }
  .img-cell img,
  .img-ph {
    display: block;
    inline-size: 100%;
    aspect-ratio: 1 / 1;
    object-fit: cover;
  }
  .img-ph {
    display: grid;
    place-items: center;
  }
  figcaption {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 12px;
  }
  .img-prompt {
    font-size: 0.85rem;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .img-meta {
    font-size: 0.74rem;
    font-family: var(--font-mono);
    color: var(--color-ink-faint);
  }
  .empty {
    color: var(--color-ink-faint);
    font-size: 0.9rem;
  }
</style>
