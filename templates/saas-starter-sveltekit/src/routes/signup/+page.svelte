<script lang="ts">
  import { Button, Field, Card, Alert, Eyebrow } from "$lib/ui";

  let { form } = $props();
</script>

<svelte:head>
  <title>Sign up · SaaS Starter</title>
</svelte:head>

<main class="section">
  <div class="content-grid">
    <section>
      <Eyebrow>Get started</Eyebrow>
      <h1>Create your organization.</h1>
      <p>
        Signing up creates your user and your first organization in one step. You become the
        owner; teammates join later by invitation with their own roles.
      </p>
    </section>

    <Card>
      <h2>New organization</h2>
      {#if form?.error}
        <Alert tone="error">{form.error}</Alert>
      {/if}
      <form method="POST">
        <Field label="Your work email" id="email">
          <input id="email" name="email" type="email" autocomplete="email" required value={form?.values?.email ?? ""} />
        </Field>
        <Field label="Organization name" id="orgName">
          <input id="orgName" name="orgName" required maxlength="120" value={form?.values?.orgName ?? ""} />
        </Field>
        <Field label="URL slug (optional)" id="slug">
          <input id="slug" name="slug" placeholder="acme-inc" value={form?.values?.slug ?? ""} />
        </Field>
        <Button type="submit" variant="primary">Create organization</Button>
      </form>
      <p class="mt-4 text-[0.9rem]">Already have an account? <a href="/login">Log in</a>.</p>
    </Card>
  </div>
</main>
