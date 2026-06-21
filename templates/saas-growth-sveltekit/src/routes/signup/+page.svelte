<script lang="ts">
  import { Button, Field, Card, Alert, Eyebrow } from "$lib/ui";

  let { form } = $props();
  // Step 2 ("verify") once a code has been emailed; "request" otherwise.
  const step = $derived(form?.step === "verify" ? "verify" : "request");
  const values = $derived(form?.values ?? {});
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
        We email you a confirmation code to verify your address. Once confirmed, we create your
        user and your first organization — you become the owner; teammates join later by invitation.
      </p>
    </section>

    <Card>
      {#if step === "request"}
        <h2>New organization</h2>
        {#if form?.error}
          <Alert tone="error">{form.error}</Alert>
        {/if}
        <form method="POST" action="?/request">
          <Field label="Your work email" id="email">
            <input id="email" name="email" type="email" autocomplete="email" required value={values.email ?? ""} />
          </Field>
          <Field label="Organization name" id="orgName">
            <input id="orgName" name="orgName" required maxlength="120" value={values.orgName ?? ""} />
          </Field>
          <Field label="URL slug (optional)" id="slug">
            <input id="slug" name="slug" placeholder="acme-inc" value={values.slug ?? ""} />
          </Field>
          <Button type="submit" variant="primary">Email me a code</Button>
        </form>
        <p class="mt-4 text-[0.9rem]">Already have an account? <a href="/login">Log in</a>.</p>
      {:else}
        <h2>Confirm your email</h2>
        <p class="text-[0.9rem]">We sent a code to <strong>{values.email}</strong>. Enter it to finish.</p>
        {#if form?.error}
          <Alert tone="error">{form.error}</Alert>
        {/if}
        <form method="POST" action="?/verify">
          <input type="hidden" name="email" value={values.email ?? ""} />
          <input type="hidden" name="orgName" value={values.orgName ?? ""} />
          <input type="hidden" name="slug" value={values.slug ?? ""} />
          <Field label="Confirmation code" id="code">
            <input id="code" name="code" inputmode="numeric" autocomplete="one-time-code" required value={form?.devCode ?? ""} />
          </Field>
          <Button type="submit" variant="primary">Confirm &amp; create organization</Button>
        </form>
        {#if form?.devCode}
          <p class="mt-4 text-[0.8rem] opacity-70">Dev mode: code prefilled ({form.devCode}).</p>
        {/if}
        <p class="mt-4 text-[0.9rem]"><a href="/signup">Use a different email</a>.</p>
      {/if}
    </Card>
  </div>
</main>
