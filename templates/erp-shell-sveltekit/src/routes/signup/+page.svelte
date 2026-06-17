<script lang="ts">
  import { Button, Field, Card, Alert, Eyebrow } from "$lib/ui";

  let { form } = $props();
</script>

<svelte:head>
  <title>Set up your company · ERP Shell</title>
</svelte:head>

<main class="section">
  <div class="content-grid">
    <section>
      <Eyebrow>One-time setup</Eyebrow>
      <h1>Set up your company.</h1>
      <p>
        This creates the single company workspace and makes you the owner.
        Employees join later by invitation, each with their own role.
      </p>
    </section>

    <Card>
      <h2>New company</h2>
      {#if form?.error}
        <Alert tone="error">{form.error}</Alert>
      {/if}
      <form method="POST">
        <Field label="Your work email" id="email">
          <input id="email" name="email" type="email" autocomplete="email" required value={form?.values?.email ?? ""} />
        </Field>
        <Field label="Company name" id="orgName">
          <input id="orgName" name="orgName" required maxlength="120" value={form?.values?.orgName ?? ""} />
        </Field>
        <Field label="URL slug (optional)" id="slug">
          <input id="slug" name="slug" placeholder="acme-ops" value={form?.values?.slug ?? ""} />
        </Field>
        <Button type="submit" variant="primary">Create company</Button>
      </form>
      <p class="mt-4 text-[0.9rem]">Already set up? <a href="/login">Log in</a>.</p>
    </Card>
  </div>
</main>
