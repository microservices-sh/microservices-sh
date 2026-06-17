<script lang="ts">
  import { Button, Field, Card, Eyebrow } from "$lib/ui";

  let { data } = $props();

  const cell = (row: Record<string, unknown>, name: string) => {
    const value = row[name];
    return value === null || value === undefined ? "—" : String(value);
  };
</script>

<svelte:head>
  <title>{data.resource} · Admin</title>
</svelte:head>

<Eyebrow>Super admin</Eyebrow>
<h1>{data.resource}</h1>
<p>{data.total} record{data.total === 1 ? "" : "s"} across all organizations.</p>

<Card>
  <form method="GET">
    <Field label="Search" id="q">
      <input id="q" name="q" value={data.search} placeholder="Search…" />
    </Field>
    <Button type="submit" variant="ghost">Search</Button>
  </form>
</Card>

<Card class="mt-6">
  {#if data.rows.length > 0}
    <ul class="list" role="list">
      {#each data.rows as row}
        <li class="list-item">
          <dl class="detail-list">
            {#each data.columns as column}
              <div><dt>{column.label}</dt><dd>{cell(row, column.name)}</dd></div>
            {/each}
          </dl>
        </li>
      {/each}
    </ul>
  {:else}
    <p>No records found.</p>
  {/if}
</Card>
