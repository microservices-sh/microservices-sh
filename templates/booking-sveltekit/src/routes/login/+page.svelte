<script lang="ts">
  import { Button, Field } from "$lib/components";

  let email = $state("");
  let code = $state("");
  let step = $state<"email" | "code">("email");
  let error = $state("");
  let busy = $state(false);

  async function post(body: Record<string, unknown>) {
    busy = true;
    error = "";
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!data.ok) error = data.error?.message ?? "Something went wrong.";
      return data;
    } finally {
      busy = false;
    }
  }

  async function requestCode(e: SubmitEvent) {
    e.preventDefault();
    const data = await post({ action: "request", email });
    if (data.ok) step = "code";
  }

  async function verifyCode(e: SubmitEvent) {
    e.preventDefault();
    const data = await post({ action: "verify", email, code });
    if (data.ok) window.location.href = "/admin";
  }
</script>

<main class="login">
  <h1>Sign in</h1>
  {#if step === "email"}
    <form onsubmit={requestCode}>
      <Field label="Email" id="email"><input id="email" type="email" bind:value={email} required autocomplete="email" /></Field>
      <Button disabled={busy}>Send code</Button>
    </form>
  {:else}
    <p>We emailed a sign-in code to <strong>{email}</strong>.</p>
    <form onsubmit={verifyCode}>
      <Field label="Code" id="code"><input id="code" inputmode="numeric" bind:value={code} required autocomplete="one-time-code" /></Field>
      <Button disabled={busy}>Verify</Button>
    </form>
  {/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</main>

<style>
  .login { max-width: 22rem; margin: 4rem auto; display: grid; gap: 1rem; }
  form { display: grid; gap: 0.75rem; }
  .error { color: #b00020; }
</style>
