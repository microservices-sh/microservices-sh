<script>
  import { goto } from "$app/navigation";
  import { Button, Field, Card, Alert, Eyebrow } from "$lib/ui";

  let { data } = $props();

  let email = $state("");
  let code = $state("");
  let step = $state("email");
  let error = $state("");
  let busy = $state(false);
  let devCode = $state("");
  let accessBlockedEmail = $state("");

  const blockedEmail = $derived(accessBlockedEmail || data.signedInEmail);

  async function post(payload) {
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

  async function requestCode(e) {
    e.preventDefault();
    const data = await post({ action: "request", email });
    if (data.ok) {
      step = "code";
      devCode = data.devCode ?? "";
    } else {
      error = data.error?.message ?? "Could not send a code. Check the email and try again.";
    }
  }

  async function verifyCode(e) {
    e.preventDefault();
    const data = await post({ action: "verify", email, code });
    if (data.ok) {
      if (data.hasCompanyAccess === false) {
        accessBlockedEmail = email;
        step = "email";
        code = "";
        devCode = "";
        return;
      }
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
  <title>Log in · Commerce Ops</title>
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
      <h2 class="login-title">{step === "email" ? "Log in" : "Enter your code"}</h2>

      {#if error}
        <div class="login-state">
          <Alert tone="error">{error}</Alert>
        </div>
      {/if}

      {#if blockedEmail}
        <div class="access-panel" role="status" aria-live="polite">
          <div class="access-panel__icon" aria-hidden="true">!</div>
          <div class="access-panel__copy">
            <strong>Email verified. Workspace access missing.</strong>
            <p>
              <span>{blockedEmail}</span> can sign in, but this account has not been added to the company workspace.
              Ask an owner to invite this email, or sign out and use another account.
            </p>
          </div>
          <form method="POST" action="/logout">
            <Button type="submit" variant="ghost">Sign out</Button>
          </form>
        </div>
      {/if}

      {#if step === "email"}
        <form onsubmit={requestCode}>
          <Field label="Work email" id="email">
            <input
              id="email"
              name="email"
              type="email"
              autocomplete="username"
              enterkeyhint="next"
              required
              bind:value={email}
              placeholder="you@company.com"
            />
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
            <input
              id="code"
              name="code"
              inputmode="numeric"
              autocomplete="one-time-code"
              enterkeyhint="done"
              required
              bind:value={code}
              placeholder="123456"
            />
          </Field>
          <div class="login-actions">
            <Button type="button" variant="ghost" onclick={restart}>← Use a different email</Button>
            <Button type="submit" variant="primary" disabled={busy}>{busy ? "Verifying…" : "Verify & continue"}</Button>
          </div>
        </form>
      {/if}

      {#if data.canSetUpCompany}
        <p class="mt-4 text-[0.9rem]">Company not set up yet? <a href="/signup">Set up the company</a>.</p>
      {/if}
    </Card>
  </div>
</main>

<style>
  .login-title {
    margin-block-end: 18px;
    letter-spacing: 0;
  }

  .login-state {
    margin-block: 0 16px;
  }

  .login-sent {
    color: var(--color-ink-soft);
    font-size: 0.9rem;
    margin-block: 0 12px;
  }

  .login-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .access-panel {
    display: grid;
    grid-template-columns: 30px minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    margin-block: 0 18px;
    padding: 14px;
    border: 1px solid rgb(202 138 4 / 0.28);
    border-radius: 8px;
    background: linear-gradient(180deg, rgb(255 251 235 / 0.96), rgb(255 247 237 / 0.88));
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.72);
  }

  .access-panel__icon {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 999px;
    background: rgb(245 158 11 / 0.14);
    color: rgb(146 64 14);
    font-weight: 800;
    line-height: 1;
  }

  .access-panel__copy {
    display: grid;
    gap: 3px;
    min-width: 0;
  }

  .access-panel__copy strong {
    color: var(--color-ink);
    font-size: 0.9rem;
    line-height: 1.2;
    letter-spacing: 0;
  }

  .access-panel__copy p {
    margin: 0;
    max-inline-size: none;
    color: var(--color-muted);
    font-size: 0.86rem;
    line-height: 1.45;
  }

  .access-panel__copy span {
    color: var(--color-ink);
    font-weight: 650;
    overflow-wrap: anywhere;
  }

  .access-panel form {
    margin: 0;
  }

  .access-panel :global(button) {
    white-space: nowrap;
  }

  @media (max-width: 640px) {
    .access-panel {
      grid-template-columns: 30px minmax(0, 1fr);
      align-items: start;
    }

    .access-panel form {
      grid-column: 2;
    }
  }
</style>
