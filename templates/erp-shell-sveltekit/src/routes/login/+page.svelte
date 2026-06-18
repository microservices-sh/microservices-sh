<script lang="ts">
  import { goto } from "$app/navigation";
  import { Button, Field, Card, Alert, Eyebrow } from "$lib/ui";

  let email = $state("");
  let code = $state("");
  let step = $state<"email" | "code">("email");
  let error = $state("");
  let busy = $state(false);
  let devCode = $state("");

  async function post(payload: Record<string, unknown>) {
    busy = true;
    error = "";
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch {
      error = "Network error — please try again.";
      return { ok: false };
    } finally {
      busy = false;
    }
  }

  async function requestCode(e: SubmitEvent) {
    e.preventDefault();
    const data = await post({ action: "request", email });
    if (data.ok) {
      step = "code";
      devCode = data.devCode ?? "";
    } else {
      error = data.error?.message ?? "Could not send a code. Check the email and try again.";
    }
  }

  async function verifyCode(e: SubmitEvent) {
    e.preventDefault();
    const data = await post({ action: "verify", email, code });
    if (data.ok) {
      await goto("/app");
    } else {
      error = data.error?.message ?? "That code didn't match. Request a new one if it expired.";
    }
  }

  function restart() {
    step = "email";
    code = "";
    error = "";
    devCode = "";
  }
</script>

<svelte:head>
  <title>Log in · ERP Shell</title>
</svelte:head>

<main class="section">
  <div class="content-grid">
    <section>
      <Eyebrow>Welcome back</Eyebrow>
      <h1>Log in to your company workspace.</h1>
      <p>
        Passwordless sign-in: we email a one-time code — no password to remember.
        Powered by <code>@microservices-sh/identity</code>.
      </p>
    </section>

    <Card>
      <h2>{step === "email" ? "Log in" : "Enter your code"}</h2>

      {#if error}
        <Alert tone="error">{error}</Alert>
      {/if}

      {#if step === "email"}
        <form onsubmit={requestCode}>
          <Field label="Work email" id="email">
            <input id="email" type="email" autocomplete="email" required bind:value={email} placeholder="you@company.com" />
          </Field>
          <Button type="submit" variant="primary" disabled={busy}>{busy ? "Sending…" : "Send code"}</Button>
        </form>
      {:else}
        <p class="login-sent">We emailed a sign-in code to <strong>{email}</strong>.</p>
        {#if devCode}
          <Alert tone="info">Dev code: <strong>{devCode}</strong></Alert>
        {/if}
        <form onsubmit={verifyCode}>
          <Field label="Sign-in code" id="code">
            <input id="code" inputmode="numeric" autocomplete="one-time-code" required bind:value={code} placeholder="123456" />
          </Field>
          <div class="login-actions">
            <Button type="button" variant="ghost" onclick={restart}>← Use a different email</Button>
            <Button type="submit" variant="primary" disabled={busy}>{busy ? "Verifying…" : "Verify & continue"}</Button>
          </div>
        </form>
      {/if}

      <p class="mt-4 text-[0.9rem]">Company not set up yet? <a href="/signup">Set up the company</a>.</p>
    </Card>
  </div>
</main>

<style>
  .login-sent {
    color: var(--color-ink-soft);
    font-size: 0.9rem;
    margin-block: 0 12px;
  }
  .login-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
</style>
