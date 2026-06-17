<script lang="ts">
  import { Card, Eyebrow, Badge } from "$lib/ui";

  let { data } = $props();

  const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;
</script>

<svelte:head>
  <title>Files · ERP Shell</title>
</svelte:head>

<main class="section">
  <Eyebrow>Document storage</Eyebrow>
  <h1>Files</h1>
  <p>Company files stored via the file-media module (object bytes live in R2).</p>

  <Card class="mt-6">
    {#if data.files.length > 0}
      <ul class="list" role="list">
        {#each data.files as file}
          <li class="list-item row-item">
            <span><strong>{file.name}</strong></span>
            <span class="nav" style="align-items: center;">
              <Badge tone="info">{file.contentType}</Badge>
              <span>{kb(file.bytes)}</span>
            </span>
          </li>
        {/each}
      </ul>
    {:else}
      <p>No files yet.</p>
    {/if}
  </Card>
</main>
