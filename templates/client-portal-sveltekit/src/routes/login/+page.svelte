<script lang="ts">
  import { dev } from "$app/environment";
  import { goto } from "$app/navigation";
  import { Alert, Button, Card, Eyebrow, Field } from "$lib/ui";

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
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      return await response.json();
    } catch {
      error = "Network error. Please try again.";
      return { ok: false };
    } finally {
      busy = false;
    }
  }

  async function requestCode(event: SubmitEvent) {
    event.preventDefault();
    const data = await post({ action: "request", email });
    if (data.ok) {
      step = "code";
      devCode = data.devCode ?? "";
    } else {
      error = data.error?.message ?? "Could not send a code. Check the email and try again.";
    }
  }

  async function verifyCode(event: SubmitEvent) {
    event.preventDefault();
    const data = await post({ action: "verify", email, code });
    if (data.ok) {
      await goto(data.redirectTo ?? "/portal");
    } else {
      error = data.error?.message ?? "That code did not match. Request a new one if it expired.";
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
  <title>Sign in · Client Portal</title>
</svelte:head>

<main class="section">
  <div class="hero-grid">
    <section>
      <Eyebrow>Account</Eyebrow>
      <h1>Sign in.</h1>
      <p>
        Use the email assigned to your customer account or staff access. The portal
        sends a one-time code and opens a server-side session.
      </p>
      {#if dev}
        <p class="dev-links">
          Local demo:
          <a href="/portal?role=customer">customer view</a>
          <a href="/admin?role=staff">staff view</a>
        </p>
      {/if}
    </section>

    <Card>
      <h2>{step === "email" ? "Get a sign-in code" : "Enter your code"}</h2>
      {#if error}
        <Alert tone="error">{error}</Alert>
      {/if}

      {#if step === "email"}
        <form onsubmit={requestCode}>
          <Field label="Email" id="email">
            <input id="email" type="email" autocomplete="email" required bind:value={email} placeholder="owner@acme.example" />
          </Field>
          <Button type="submit" variant="primary" disabled={busy}>{busy ? "Sending..." : "Send code"}</Button>
        </form>
      {:else}
        <p class="login-sent">We emailed a sign-in code to <strong>{email}</strong>.</p>
        {#if devCode}
          <Alert tone="warn">Dev code: <strong>{devCode}</strong></Alert>
        {/if}
        <form onsubmit={verifyCode}>
          <Field label="Sign-in code" id="code">
            <input id="code" inputmode="numeric" autocomplete="one-time-code" required bind:value={code} placeholder="123456" />
          </Field>
          <div class="login-actions">
            <Button type="button" variant="ghost" onclick={restart}>Use another email</Button>
            <Button type="submit" variant="primary" disabled={busy}>{busy ? "Verifying..." : "Verify"}</Button>
          </div>
        </form>
      {/if}
    </Card>
  </div>
</main>

<style>
  .dev-links,
  .login-sent {
    color: var(--color-ink-soft);
    font-size: 0.9rem;
  }
  .dev-links {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 16px;
  }
  .login-sent {
    margin-block: 0 12px;
  }
  .login-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
</style>
