<script lang="ts">
  let { form } = $props();
</script>

<svelte:head>
  <title>Log in · SaaS Starter</title>
</svelte:head>

<main class="section">
  <div class="content-grid">
    <section>
      <p class="eyebrow">Welcome back</p>
      <h1>Log in to your workspace.</h1>
      <p>
        This starter uses a demo email session so it runs locally with no provider setup.
        Swap in <code>@microservices-sh/auth</code> for production sign-in.
      </p>
    </section>

    <section class="panel">
      <h2>Log in</h2>
      {#if form?.error}
        <div class="status error" aria-live="polite">{form.error}</div>
      {/if}
      <form method="POST">
        <div class="field">
          <label for="email">Work email</label>
          <input id="email" name="email" type="email" autocomplete="email" required value={form?.values?.email ?? ""} />
        </div>
        <button type="submit">Continue</button>
      </form>
      <p class="mt-4 text-[0.9rem]">No account yet? <a href="/signup">Create an organization</a>.</p>
    </section>
  </div>
</main>
