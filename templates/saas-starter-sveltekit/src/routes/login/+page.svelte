<script lang="ts">
  import { Button, Field, Card, Alert, Eyebrow } from "$lib/ui";

  let { form } = $props();
</script>

<svelte:head>
  <title>Log in · SaaS Starter</title>
</svelte:head>

<main class="section">
  <div class="content-grid">
    <section>
      <Eyebrow>Welcome back</Eyebrow>
      <h1>Log in to your workspace.</h1>
      <p>
        This starter uses a demo email session so it runs locally with no provider setup.
        Swap in <code>@microservices-sh/auth</code> for production sign-in.
      </p>
    </section>

    <Card>
      <h2>Log in</h2>
      {#if form?.error}
        <Alert tone="error">{form.error}</Alert>
      {/if}
      <form method="POST">
        <Field label="Work email" id="email">
          <input id="email" name="email" type="email" autocomplete="email" required value={form?.values?.email ?? ""} />
        </Field>
        <Button type="submit" variant="primary">Continue</Button>
      </form>
      <p class="mt-4 text-[0.9rem]">No account yet? <a href="/signup">Create an organization</a>.</p>
    </Card>
  </div>
</main>
