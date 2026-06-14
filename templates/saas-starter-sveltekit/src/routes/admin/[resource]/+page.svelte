<script lang="ts">
  let { data } = $props();

  const cell = (row: Record<string, unknown>, name: string) => {
    const value = row[name];
    return value === null || value === undefined ? "—" : String(value);
  };
</script>

<svelte:head>
  <title>{data.resource} · Admin</title>
</svelte:head>

<p class="eyebrow">Super admin</p>
<h1>{data.resource}</h1>
<p>{data.total} record{data.total === 1 ? "" : "s"} across all organizations.</p>

<form method="GET" class="panel">
  <div class="field">
    <label for="q">Search</label>
    <input id="q" name="q" value={data.search} placeholder="Search…" />
  </div>
  <button type="submit" class="secondary">Search</button>
</form>

<section class="panel mt-6">
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
</section>
