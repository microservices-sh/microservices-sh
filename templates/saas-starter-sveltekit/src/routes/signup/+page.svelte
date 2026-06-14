<script lang="ts">
  let { form } = $props();
</script>

<svelte:head>
  <title>Sign up · SaaS Starter</title>
</svelte:head>

<main class="section">
  <div class="content-grid">
    <section>
      <p class="eyebrow">Get started</p>
      <h1>Create your organization.</h1>
      <p>
        Signing up creates your user and your first organization in one step. You become the
        owner; teammates join later by invitation with their own roles.
      </p>
    </section>

    <section class="panel">
      <h2>New organization</h2>
      {#if form?.error}
        <div class="status error" aria-live="polite">{form.error}</div>
      {/if}
      <form method="POST">
        <div class="field">
          <label for="email">Your work email</label>
          <input id="email" name="email" type="email" autocomplete="email" required value={form?.values?.email ?? ""} />
        </div>
        <div class="field">
          <label for="orgName">Organization name</label>
          <input id="orgName" name="orgName" required maxlength="120" value={form?.values?.orgName ?? ""} />
        </div>
        <div class="field">
          <label for="slug">URL slug (optional)</label>
          <input id="slug" name="slug" placeholder="acme-inc" value={form?.values?.slug ?? ""} />
        </div>
        <button type="submit">Create organization</button>
      </form>
      <p class="mt-4 text-[0.9rem]">Already have an account? <a href="/login">Log in</a>.</p>
    </section>
  </div>
</main>
