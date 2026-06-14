<script lang="ts">
  let { data, form } = $props();
</script>

<svelte:head>
  <title>Accept invitation · SaaS Starter</title>
</svelte:head>

<main class="section">
  <section class="panel">
    <p class="eyebrow">Team invitation</p>
    <h1>Join the organization.</h1>
    {#if form?.error}
      <div class="status error" aria-live="polite">{form.error}</div>
    {/if}
    <form method="POST">
      <div class="field">
        <label for="token">Invitation token</label>
        <input id="token" name="token" required value={data.token} />
      </div>
      <button type="submit">Accept invitation</button>
    </form>
  </section>
</main>
