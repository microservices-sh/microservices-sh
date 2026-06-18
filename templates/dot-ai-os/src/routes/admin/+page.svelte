<script lang="ts">
  import { Eyebrow } from "$lib/ui";

  let { data } = $props();
</script>

<svelte:head>
  <title>Admin · DOT AI OS</title>
</svelte:head>

<Eyebrow>Platform overview</Eyebrow>
<h1>All organizations</h1>
<p>Super-admin view across every tenant, served by the admin-shell table gateway.</p>

<div class="stat-grid">
  {#each data.counts as item}
    <a class="stat-card" href={`/admin/${item.name}`}>
      <span>{item.name}</span>
      <strong>{item.total}</strong>
    </a>
  {/each}
</div>
