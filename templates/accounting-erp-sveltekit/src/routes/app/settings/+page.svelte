<script>
  import { Card, PageHeader, Badge, Button, Field, Alert } from "$lib/ui";

  let { data, form } = $props();

  // Prefill from the live org, falling back to a rejected submit's values. The
  // function indirection keeps this a one-time initial read (the form is a plain
  // POST, so a successful save remounts with fresh data). After this the inputs
  // are user-owned local state.
  function initialValues() {
    return { name: form?.values?.name ?? data.org.name, slug: form?.values?.slug ?? data.org.slug };
  }
  const seed = initialValues();
  let name = $state(seed.name);
  let slug = $state(seed.slug);
</script>

<svelte:head>
  <title>Settings · Accounting ERP</title>
</svelte:head>

<main class="section">
  <PageHeader
    eyebrow="Organization settings"
    title={data.org.name}
    description="Settings, your effective permissions, and recent org activity."
  />

  {#if form?.renamed}
    <Alert tone="success">Company details updated.</Alert>
  {:else if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <div class="content-grid mt-6">
    <Card title="Organization">
      {#if data.canManage}
        <form method="POST" action="?/rename" class="rename">
          <Field label="Company name" id="name">
            <input id="name" name="name" maxlength="120" required bind:value={name} />
          </Field>
          <Field label="Workspace URL" id="slug">
            <input id="slug" name="slug" bind:value={slug} />
          </Field>
          <p class="rename-hint">Workspace lives at <code>/{slug || data.org.slug}</code>.</p>
          <Button type="submit" variant="primary">Save changes</Button>
        </form>
        <dl class="detail-list mt-6">
          <div><dt>Org ID</dt><dd><code>{data.org.id}</code></dd></div>
          <div><dt>Signed in as</dt><dd>{data.user.email}</dd></div>
        </dl>
      {:else}
        <dl class="detail-list">
          <div><dt>Name</dt><dd>{data.org.name}</dd></div>
          <div><dt>Slug</dt><dd><code>{data.org.slug}</code></dd></div>
          <div><dt>Org ID</dt><dd><code>{data.org.id}</code></dd></div>
          <div><dt>Signed in as</dt><dd>{data.user.email}</dd></div>
        </dl>
      {/if}

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

<style>
  .rename-hint {
    margin-block: -4px 12px;
    font-size: 0.82rem;
    color: var(--color-ink-soft);
  }
  .rename-hint code {
    font-family: var(--font-mono);
    color: var(--color-act);
  }
</style>
