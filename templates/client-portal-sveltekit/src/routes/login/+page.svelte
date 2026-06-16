<script lang="ts">
  import { Button, Panel, Eyebrow } from "$lib/components";
  let { data } = $props();
</script>

<svelte:head>
  <title>Sign in · Client Portal</title>
</svelte:head>

<main class="section">
  <div class="hero-grid">
    <section>
      <Eyebrow>Account</Eyebrow>
      <h1>Sign in.</h1>
      <p>
        Production auth is passwordless email-code, served by the
        <code>@microservices-sh/auth</code> module. This local sign-in chooses which session
        to establish so you can exercise both the customer portal and the staff admin side.
      </p>
      {#if data.user}
        <p>
          Signed in as <strong>{data.user.email}</strong> ({data.user.role}).
          <a href={data.user.role === "staff" ? "/admin" : "/portal"}>Continue →</a>
        </p>
      {/if}
    </section>

    <Panel>
      <h2>Choose a session</h2>
      <form method="POST">
        <fieldset>
          <legend>Sign in as</legend>
          <label class="list-item">
            <input type="radio" name="role" value="customer" checked />
            Customer — sees only their own invoices and files
          </label>
          <label class="list-item">
            <input type="radio" name="role" value="staff" />
            Staff — sees the admin side
          </label>
        </fieldset>
        <Button>Sign in</Button>
      </form>
    </Panel>
  </div>
</main>
