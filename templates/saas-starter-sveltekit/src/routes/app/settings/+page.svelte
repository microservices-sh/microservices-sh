<script lang="ts">
  import { Card, Eyebrow, Badge } from "$lib/ui";

  let { data } = $props();
</script>

<svelte:head>
  <title>Settings · SaaS Starter</title>
</svelte:head>

<main class="section">
  <Eyebrow>Organization settings</Eyebrow>
  <h1>{data.org.name}</h1>
  <p>Settings, your effective permissions, and recent org activity.</p>

  <div class="content-grid mt-6">
    <Card>
      <h2>Organization</h2>
      <dl class="detail-list">
        <div><dt>Name</dt><dd>{data.org.name}</dd></div>
        <div><dt>Slug</dt><dd><code>{data.org.slug}</code></dd></div>
        <div><dt>Org ID</dt><dd><code>{data.org.id}</code></dd></div>
        <div><dt>Signed in as</dt><dd>{data.user.email}</dd></div>
      </dl>

      <h3 class="mt-6">Your permissions</h3>
      <div class="nav">
        {#each data.permissions as permission}
          <Badge>{permission}</Badge>
        {:else}
          <Badge tone="neutral">none</Badge>
        {/each}
      </div>
    </Card>

    <Card>
      <h2>Recent activity</h2>
      {#if data.activity.length > 0}
        <ul class="list" role="list">
          {#each data.activity as entry}
            <li class="list-item row-item">
              <span>{entry.eventName}</span>
              <span>{new Date(entry.createdAt).toLocaleString()}</span>
            </li>
          {/each}
        </ul>
      {:else}
        <p>No recorded activity yet.</p>
      {/if}
    </Card>
  </div>
</main>
