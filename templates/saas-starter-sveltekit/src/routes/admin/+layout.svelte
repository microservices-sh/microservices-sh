<script lang="ts">
  import { page } from "$app/stores";
  import { Panel, Eyebrow } from "$lib/components";

  let { data, children } = $props();
</script>

<div class="content-grid">
  <Panel as="aside" aria-label="Admin resources">
    <Eyebrow>Super admin</Eyebrow>
    <nav class="nav" style="flex-direction: column; align-items: stretch;">
      <a href="/admin" aria-current={$page.url.pathname === "/admin" ? "page" : undefined}>Overview</a>
      {#each data.resources as resource}
        <a href={`/admin/${resource.name}`} aria-current={$page.url.pathname === `/admin/${resource.name}` ? "page" : undefined}>
          {resource.name}
        </a>
      {/each}
    </nav>
  </Panel>

  <div>
    {@render children()}
  </div>
</div>
