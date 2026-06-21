<script>
  import { Button, Field, Card, Eyebrow, ResourceTable } from "$lib/ui";

  let { data } = $props();

  const cell = (row, name) => {
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

{#if data.rows.length > 0}
  <div class="mt-6">
    <ResourceTable caption={`${data.resource} records`}>
      {#snippet head()}
        <tr>
          {#each data.columns as column}
            <th scope="col">{column.label}</th>
          {/each}
        </tr>
      {/snippet}

      {#each data.rows as row}
        <tr>
          {#each data.columns as column}
            <td data-label={column.label}>{cell(row, column.name)}</td>
          {/each}
        </tr>
      {/each}
    </ResourceTable>
  </div>
{:else}
  <Card class="mt-6">
    <p>No records found.</p>
  </Card>
{/if}
