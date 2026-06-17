<script lang="ts">
  import { enhance } from "$app/forms";
  import { Button, Field, Card, Alert, Eyebrow, Logo } from "$lib/ui";

  let { form } = $props();

  const STEPS = ["Company", "Team", "Review"];
  let step = $state(1);
  let submitting = $state(false);

  let email = $state(form?.values?.email ?? "");
  let orgName = $state(form?.values?.orgName ?? "");
  let slug = $state(form?.values?.slug ?? "");
  let slugEdited = $state(Boolean(form?.values?.slug));

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
  <title>Set up your company · ERP Shell</title>
</svelte:head>

<main class="setup">
  <div class="setup-card">
    <header class="setup-head">
      <Logo href={null} />
      <Eyebrow>First-run setup</Eyebrow>
      <h1>Set up your company</h1>
      <p class="setup-lead">One company workspace, one owner — that's you. Takes under a minute.</p>
    </header>

    <ol class="setup-steps" aria-label="Setup progress">
      {#each STEPS as label, i}
        <li class="setup-step" class:is-active={step === i + 1} class:is-done={step > i + 1} aria-current={step === i + 1 ? "step" : undefined}>
          <span class="setup-step-num">{step > i + 1 ? "✓" : i + 1}</span>
          <span class="setup-step-label">{label}</span>
        </li>
      {/each}
    </ol>

    <Card>
      {#if form?.error}
        <Alert tone="error">{form.error}</Alert>
      {/if}

      <form
        method="POST"
        use:enhance={() => {
          submitting = true;
          return async ({ update }) => {
            await update();
            submitting = false;
          };
        }}
      >
        <!-- Step 1 — Company -->
        <section class="setup-panel" hidden={step !== 1}>
          <h2>Your company</h2>
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

        <!-- Step 2 — Team -->
        <section class="setup-panel" hidden={step !== 2}>
          <h2>Invite your team <span class="setup-optional">optional</span></h2>
          <p class="setup-hint">Add teammates now or later from Team. They'll get an invitation link.</p>
          {#if invites.length === 0}
            <p class="setup-empty">No teammates yet.</p>
          {:else}
            <ul class="setup-invites">
              {#each invites as invite, i (i)}
                <li class="setup-invite">
                  <input class="setup-invite-email" type="email" placeholder="teammate@company.com" bind:value={invite.email} aria-label="Teammate email" />
                  <select bind:value={invite.role} aria-label="Role">
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                  <Button type="button" variant="ghost" size="sm" onclick={() => removeInvite(i)} aria-label="Remove">✕</Button>
                </li>
              {/each}
            </ul>
          {/if}
          <Button type="button" variant="ghost" size="sm" onclick={addInvite}>+ Add teammate</Button>
        </section>

        <!-- Step 3 — Review -->
        <section class="setup-panel" hidden={step !== 3}>
          <h2>Review</h2>
          <dl class="setup-review">
            <div><dt>Company</dt><dd>{orgName || "—"}</dd></div>
            <div><dt>Workspace</dt><dd><code>/{slug || "—"}</code></dd></div>
            <div><dt>Owner</dt><dd>{email || "—"}</dd></div>
            <div><dt>Invites</dt><dd>{validInvites.length === 0 ? "None" : `${validInvites.length} teammate${validInvites.length === 1 ? "" : "s"}`}</dd></div>
          </dl>

          <!-- Authoritative values submitted to the server -->
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="orgName" value={orgName} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="invites" value={JSON.stringify(validInvites)} />
        </section>

        <footer class="setup-nav">
          {#if step > 1}
            <Button type="button" variant="ghost" onclick={goBack}>Back</Button>
          {:else}
            <a class="setup-link" href="/login">Already set up? Log in</a>
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
  </div>
</main>

<style>
  .setup {
    min-block-size: 100dvh;
    display: grid;
    place-items: start center;
    padding: clamp(24px, 6vh, 72px) 20px 60px;
  }
  .setup-card {
    inline-size: 100%;
    max-inline-size: 540px;
  }
  .setup-head {
    text-align: center;
    margin-block-end: 24px;
  }
  .setup-head :global(.logo) {
    margin-block-end: 18px;
  }
  .setup-head h1 {
    font-size: 1.9rem;
  }
  .setup-lead {
    margin: 8px auto 0;
    color: var(--color-ink-soft);
    max-inline-size: 42ch;
  }
  /* Progress stepper */
  .setup-steps {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    list-style: none;
    margin: 0 0 18px;
    padding: 0;
  }
  .setup-step {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--color-ink-faint);
    font-size: 0.8rem;
    font-family: var(--font-mono);
  }
  .setup-step:not(:last-child)::after {
    content: "";
    inline-size: 26px;
    block-size: 1px;
    background: var(--color-line-strong);
    margin-inline-start: 8px;
  }
  .setup-step-num {
    display: grid;
    place-items: center;
    inline-size: 24px;
    block-size: 24px;
    border-radius: 50%;
    border: 1px solid var(--color-line-strong);
    font-size: 0.75rem;
  }
  .setup-step.is-active {
    color: var(--color-ink);
  }
  .setup-step.is-active .setup-step-num {
    border-color: var(--color-act);
    color: var(--color-act);
    box-shadow: var(--focus-ring);
  }
  .setup-step.is-done .setup-step-num {
    background: var(--color-act);
    border-color: var(--color-act);
    color: #fff;
  }
  .setup-panel h2 {
    font-size: 1.1rem;
    margin-block-end: 14px;
  }
  .setup-optional {
    font-size: 0.7rem;
    font-weight: 500;
    color: var(--color-ink-faint);
    font-family: var(--font-mono);
    border: 1px solid var(--color-line);
    border-radius: 99px;
    padding: 1px 8px;
    margin-inline-start: 6px;
    vertical-align: middle;
  }
  .setup-hint {
    font-size: 0.84rem;
    color: var(--color-ink-soft);
    margin-block: 2px 0;
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
    padding: 10px 0;
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
  .setup-review {
    display: grid;
    gap: 0;
    margin: 0 0 4px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    overflow: hidden;
  }
  .setup-review > div {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    padding: 11px 14px;
  }
  .setup-review > div:not(:last-child) {
    border-block-end: 1px solid var(--color-line);
  }
  .setup-review dt {
    color: var(--color-ink-faint);
    font-size: 0.82rem;
  }
  .setup-review dd {
    margin: 0;
    font-weight: 500;
    text-align: end;
  }
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
  .setup-link {
    font-size: 0.85rem;
    color: var(--color-ink-soft);
  }
  .setup-link:hover {
    color: var(--color-green-dark);
  }
</style>
