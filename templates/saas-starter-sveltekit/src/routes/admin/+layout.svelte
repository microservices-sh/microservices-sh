<script lang="ts">
  import { page } from "$app/stores";

  let { data, children } = $props();
</script>

<div class="content-grid">
  <aside class="panel" aria-label="Admin resources">
    <p class="eyebrow">Super admin</p>
    <nav class="nav" style="flex-direction: column; align-items: stretch;">
      <a href="/admin" aria-current={$page.url.pathname === "/admin" ? "page" : undefined}>Overview</a>
      {#each data.resources as resource}
        <a href={`/admin/${resource.name}`} aria-current={$page.url.pathname === `/admin/${resource.name}` ? "page" : undefined}>
          {resource.name}
        </a>
      {/each}
    </nav>
  </aside>

  <div>
    {@render children()}
  </div>
</div>
