<script lang="ts">
  let { data } = $props();
</script>

<svelte:head>
  <title>Admin · SaaS Starter</title>
</svelte:head>

<p class="eyebrow">Platform overview</p>
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
