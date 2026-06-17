<script lang="ts">
  import { page } from "$app/stores";
  import { Card, Eyebrow } from "$lib/ui";

  let { data, children } = $props();
</script>

<div class="content-grid">
  <Card>
    <Eyebrow>Super admin</Eyebrow>
    <nav class="nav" aria-label="Admin resources" style="flex-direction: column; align-items: stretch;">
      <a href="/admin" aria-current={$page.url.pathname === "/admin" ? "page" : undefined}>Overview</a>
      {#each data.resources as resource}
        <a href={`/admin/${resource.name}`} aria-current={$page.url.pathname === `/admin/${resource.name}` ? "page" : undefined}>
          {resource.name}
        </a>
      {/each}
    </nav>
  </Card>

  <div>
    {@render children()}
  </div>
</div>
