<script lang="ts">
  let { data } = $props();
</script>

<svelte:head>
  <title>Sign in · Client Portal</title>
</svelte:head>

<main class="section">
  <div class="hero-grid">
    <section>
      <p class="eyebrow">Account</p>
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

    <section class="panel">
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
        <button type="submit">Sign in</button>
      </form>
    </section>
  </div>
</main>
