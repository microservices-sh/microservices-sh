<script lang="ts">
  import { enhance, applyAction } from "$app/forms";
  import { goto } from "$app/navigation";
  import { Button, Field, Card, Alert, Eyebrow } from "$lib/ui";

  let { form } = $props();

  const STEPS = ["Company", "Team", "Review"];
  let step = $state(1);
  let submitting = $state(false);

  function initialFormValues() {
    return form?.values ?? {};
  }
  const initialValues = initialFormValues();
  let email = $state(initialValues.email ?? "");
  let orgName = $state(initialValues.orgName ?? "");
  let slug = $state(initialValues.slug ?? "");
  let slugEdited = $state(Boolean(initialValues.slug));

  type Invite = { email: string; role: "admin" | "member" };
  let invites = $state<Invite[]>([]);

  function slugify(v: string): string {
    return v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 63);
  }
  // Live-derive the slug from the company name until the user edits it directly.
  $effect(() => {
    if (!slugEdited) slug = slugify(orgName);
  });

  const emailOk = (e: string) => /.+@.+\..+/.test(e.trim());
  const step1Valid = $derived(emailOk(email) && orgName.trim().length > 0 && slug.length > 0);
  const validInvites = $derived(invites.filter((i) => emailOk(i.email)));

  function addInvite() {
    invites = [...invites, { email: "", role: "member" }];
  }
  function removeInvite(i: number) {
    invites = invites.filter((_, n) => n !== i);
  }
  function goNext() {
    if (step === 1 && !step1Valid) return;
    if (step < 3) step += 1;
  }
  function goBack() {
    if (step > 1) step -= 1;
  }
</script>

<svelte:head>
  <title>Set up your company · Commerce Ops</title>
</svelte:head>

<main class="setup">
  <div class="setup-card">
    <header class="setup-head">
      <Eyebrow>First-run setup</Eyebrow>
      <h1>Set up your company</h1>
      <p class="setup-lead">One company workspace, one owner — that's you. Takes under a minute.</p>
    </header>

    <ol class="setup-steps" aria-label="Setup progress" style="--steps: {STEPS.length}">
      {#each STEPS as label, i}
        <li
          class="setup-step"
          class:is-active={step === i + 1}
          class:is-done={step > i + 1}
          aria-current={step === i + 1 ? "step" : undefined}
        >
          <span class="setup-step-num">{step > i + 1 ? "✓" : i + 1}</span>
          <span class="setup-step-label">{label}</span>
        </li>
      {/each}
    </ol>

    <Card class="setup-formcard">
      {#if form?.error}
        <Alert tone="error">{form.error}</Alert>
      {/if}

      <form
        method="POST"
        use:enhance={() => {
          submitting = true;
          // Follow the success redirect explicitly; relying on update() here is
          // version-dependent and can silently leave the user on /signup. On
          // failure, apply the action result so the error Alert renders.
          return async ({ result }) => {
            submitting = false;
            if (result.type === "redirect") {
              await goto(result.location);
            } else {
              await applyAction(result);
            }
          };
        }}
      >
        <!-- Step 1 — Company -->
        {#if step === 1}
          <section class="setup-panel">
            <h2>Your company</h2>
            <p class="setup-sub">The essentials. You can change everything later from Settings.</p>
            <Field label="Your work email" id="email">
              <input id="email" type="email" autocomplete="email" bind:value={email} placeholder="you@company.com" />
            </Field>
            <Field label="Company name" id="orgName">
              <input id="orgName" maxlength="120" bind:value={orgName} placeholder="Acme Manufacturing" />
            </Field>
            <Field label="Workspace URL" id="slug">
              <input id="slug" bind:value={slug} oninput={() => (slugEdited = true)} placeholder="acme" />
            </Field>
            <p class="setup-hint">Your workspace will live at <code>/{slug || "your-company"}</code>. You become the owner.</p>
          </section>
        {/if}

        <!-- Step 2 — Team -->
        {#if step === 2}
          <section class="setup-panel">
            <h2>Invite your team <span class="setup-optional">optional</span></h2>
            <p class="setup-sub">Add teammates now or later from Team. They'll get an invitation link.</p>
            {#if invites.length === 0}
              <p class="setup-empty">No teammates yet — it's just you for now.</p>
            {:else}
              <ul class="setup-invites">
                {#each invites as invite, i (i)}
                  <li class="setup-invite">
                    <input class="setup-invite-email" type="email" placeholder="teammate@company.com" bind:value={invite.email} aria-label="Teammate email" />
                    <select bind:value={invite.role} aria-label="Role">
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                    <Button type="button" variant="ghost" size="sm" onclick={() => removeInvite(i)} aria-label="Remove teammate">✕</Button>
                  </li>
                {/each}
              </ul>
            {/if}
            <Button type="button" variant="ghost" size="sm" onclick={addInvite}>+ Add teammate</Button>
          </section>
        {/if}

        <!-- Step 3 — Review -->
        {#if step === 3}
          <section class="setup-panel">
            <h2>Review &amp; create</h2>
            <p class="setup-sub">Confirm the details below, then create your workspace.</p>
            <dl class="setup-review">
              <div><dt>Company</dt><dd>{orgName || "—"}</dd></div>
              <div><dt>Workspace</dt><dd><code>/{slug || "—"}</code></dd></div>
              <div><dt>Owner</dt><dd>{email || "—"}</dd></div>
              <div><dt>Invites</dt><dd>{validInvites.length === 0 ? "None" : `${validInvites.length} teammate${validInvites.length === 1 ? "" : "s"}`}</dd></div>
            </dl>
          </section>
        {/if}

        <!-- Authoritative values submitted to the server (always present in the form) -->
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="orgName" value={orgName} />
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="invites" value={JSON.stringify(validInvites)} />

        <footer class="setup-nav">
          {#if step > 1}
            <Button type="button" variant="ghost" onclick={goBack}>← Back</Button>
          {/if}

          <div class="setup-nav-right">
            {#if step === 2}
              <Button type="button" variant="ghost" onclick={goNext}>Skip</Button>
            {/if}
            {#if step < 3}
              <Button type="button" variant="primary" onclick={goNext} disabled={step === 1 && !step1Valid}>Continue</Button>
            {:else}
              <Button type="submit" variant="primary" disabled={submitting || !step1Valid}>
                {submitting ? "Creating…" : "Create company"}
              </Button>
            {/if}
          </div>
        </footer>
      </form>
    </Card>

    <p class="setup-foot">Step {step} of {STEPS.length} · Secured workspace · You stay in control</p>
  </div>
</main>

<style>
  .setup {
    min-block-size: calc(100dvh - 2px);
    display: grid;
    place-items: start center;
    padding: clamp(28px, 7vh, 84px) 20px 64px;
    /* Soft brand wash behind the card for depth (light + dark via tokens). */
    background:
      radial-gradient(900px 420px at 50% -8%, color-mix(in srgb, var(--color-act) 9%, transparent), transparent 70%);
  }
  .setup-card {
    inline-size: 100%;
    max-inline-size: 540px;
  }

  /* ── Header — always centered ─────────────────────────────────────────── */
  /* Flex-column + align-items:center so EVERY child box is centered, not just
     its text. The global app.css `h1` caps width (max-inline-size:16ch) and has
     margin-left:0, which left-pins a plain block heading — text-align alone
     can't fix that, so we center the boxes here and lift the cap below. */
  .setup-head {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    margin-block-end: 26px;
    animation: rise 480ms var(--ease) both;
  }
  .setup-head h1 {
    max-inline-size: none;
    margin: 2px 0 0;
    font-size: clamp(1.7rem, 1.3rem + 1.4vw, 2.05rem);
    font-weight: 600;
    letter-spacing: -0.012em;
    line-height: 1.1;
    color: var(--color-ink);
  }
  .setup-lead {
    margin: 10px auto 0;
    color: var(--color-ink-soft);
    max-inline-size: 40ch;
    font-size: 0.95rem;
    line-height: 1.5;
  }

  /* ── Progress stepper — connected rail ────────────────────────────────── */
  .setup-steps {
    display: grid;
    grid-template-columns: repeat(var(--steps), 1fr);
    align-items: start;
    list-style: none;
    margin: 0 0 20px;
    padding: 0;
    animation: rise 480ms var(--ease) both;
    animation-delay: 60ms;
  }
  .setup-step {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: var(--color-ink-faint);
    font-size: 0.76rem;
    font-family: var(--font-mono);
    letter-spacing: 0.02em;
    text-align: center;
  }
  /* Connector rail behind the nodes (drawn from each node to the previous one). */
  .setup-step:not(:first-child)::before {
    content: "";
    position: absolute;
    inset-block-start: 13px;
    inset-inline-end: 50%;
    inline-size: 100%;
    block-size: 2px;
    background: var(--color-line-strong);
    z-index: 0;
  }
  .setup-step.is-active:not(:first-child)::before,
  .setup-step.is-done:not(:first-child)::before {
    background: var(--color-act);
  }
  .setup-step-num {
    position: relative;
    z-index: 1;
    display: grid;
    place-items: center;
    inline-size: 28px;
    block-size: 28px;
    border-radius: 50%;
    border: 2px solid var(--color-line-strong);
    background: var(--color-paper);
    font-size: 0.78rem;
    transition: all 260ms var(--ease);
  }
  .setup-step.is-active {
    color: var(--color-ink);
  }
  .setup-step.is-active .setup-step-num {
    border-color: var(--color-act);
    color: var(--color-act);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-act) 14%, transparent);
  }
  .setup-step.is-done {
    color: var(--color-ink-soft);
  }
  .setup-step.is-done .setup-step-num {
    background: var(--color-act);
    border-color: var(--color-act);
    color: #fff;
  }

  /* ── Form card — subtle brand top accent ──────────────────────────────── */
  .setup-card :global(.setup-formcard) {
    border-block-start: 2px solid var(--color-act);
    box-shadow: var(--shadow-card);
    animation: rise 520ms var(--ease) both;
    animation-delay: 110ms;
  }
  .setup-card :global(.setup-formcard .card__body) {
    padding: clamp(20px, 4vw, 28px);
  }

  /* ── Panels ───────────────────────────────────────────────────────────── */
  .setup-panel {
    animation: panel 320ms var(--ease) both;
  }
  .setup-panel h2 {
    font-size: 1.12rem;
    font-weight: 600;
    letter-spacing: -0.008em;
    margin: 0;
  }
  .setup-sub {
    margin: 4px 0 16px;
    color: var(--color-ink-soft);
    font-size: 0.86rem;
    line-height: 1.45;
  }
  .setup-optional {
    font-size: 0.66rem;
    font-weight: 500;
    color: var(--color-ink-faint);
    font-family: var(--font-mono);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border: 1px solid var(--color-line);
    border-radius: 99px;
    padding: 2px 8px;
    margin-inline-start: 8px;
    vertical-align: middle;
  }
  .setup-hint {
    font-size: 0.82rem;
    color: var(--color-ink-soft);
    margin-block: 12px 0;
    padding-block-start: 12px;
    border-block-start: 1px solid var(--color-line);
  }
  .setup-hint code,
  .setup-review code {
    font-family: var(--font-mono);
    font-size: 0.85em;
    color: var(--color-act);
  }
  .setup-empty {
    color: var(--color-ink-faint);
    font-size: 0.86rem;
    padding: 14px;
    margin: 0 0 12px;
    border: 1px dashed var(--color-line-strong);
    border-radius: var(--radius-md);
    text-align: center;
  }
  .setup-invites {
    list-style: none;
    margin: 0 0 12px;
    padding: 0;
    display: grid;
    gap: 8px;
  }
  .setup-invite {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: 8px;
    align-items: center;
  }
  .setup-invite-email,
  .setup-invite select {
    min-block-size: 38px;
    padding: 8px 11px;
    border: 1px solid var(--color-line-strong);
    border-radius: var(--radius-md);
    background: var(--color-panel);
    color: var(--color-ink);
    font: inherit;
    font-size: 0.9rem;
  }
  .setup-invite-email:focus,
  .setup-invite select:focus {
    outline: none;
    border-color: var(--color-act);
    box-shadow: var(--focus-ring);
  }

  /* ── Review ───────────────────────────────────────────────────────────── */
  .setup-review {
    display: grid;
    gap: 0;
    margin: 0;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    overflow: hidden;
    background: var(--color-panel-subtle);
  }
  .setup-review > div {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 16px;
    padding: 12px 15px;
  }
  .setup-review > div:not(:last-child) {
    border-block-end: 1px solid var(--color-line);
  }
  .setup-review dt {
    color: var(--color-ink-faint);
    font-size: 0.78rem;
    font-family: var(--font-mono);
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }
  .setup-review dd {
    margin: 0;
    font-weight: 500;
    text-align: end;
    color: var(--color-ink);
  }

  /* ── Footer nav ───────────────────────────────────────────────────────── */
  .setup-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-block-start: 22px;
    padding-block-start: 18px;
    border-block-start: 1px solid var(--color-line);
  }
  .setup-nav-right {
    display: inline-flex;
    gap: 10px;
  }
  .setup-foot {
    margin: 16px 0 0;
    text-align: center;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    letter-spacing: 0.04em;
    color: var(--color-ink-faint);
  }

  @keyframes rise {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: none; }
  }
  @keyframes panel {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    .setup-head,
    .setup-steps,
    .setup-card :global(.setup-formcard),
    .setup-panel {
      animation: none;
    }
    .setup-step-num {
      transition: none;
    }
  }
</style>
