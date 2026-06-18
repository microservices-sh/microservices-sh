<script lang="ts">
  import { enhance } from "$app/forms";
  import { Card, Eyebrow, Badge, Button, Field, Alert } from "$lib/ui";

  let { data, form } = $props();

  const when = (iso: string) => new Date(iso).toLocaleString();
  const preview = (values: Record<string, unknown>) =>
    Object.entries(values)
      .map(([k, v]) => `${k}: ${v}`)
      .join(" · ") || "(no values)";
</script>

<svelte:head>
  <title>Forms · ERP Shell</title>
</svelte:head>

<main class="section">
  <Eyebrow>Intake forms</Eyebrow>
  <h1>Forms</h1>
  <p>Define intake forms and review submissions, powered by the forms-intake module.</p>

  {#if form?.created}
    <Alert tone="success">Form created.</Alert>
  {:else if form?.error}
    <Alert tone="error">{form.error}</Alert>
  {/if}

  <div class="content-grid mt-6">
    <Card>
      <h2>Forms</h2>
      {#if data.forms.length > 0}
        <ul class="list" role="list">
          {#each data.forms as f}
            <li class="list-item row-item">
              <span><strong>{f.name}</strong> · {f.fieldCount} field{f.fieldCount === 1 ? "" : "s"}</span>
              <span class="nav" style="align-items: center;">
                <Badge tone={f.status === "published" ? "good" : "neutral"}>{f.status}</Badge>
                <a class="forms-view" href={`/app/forms?form=${f.id}`} class:is-active={data.selectedFormId === f.id}>View submissions</a>
              </span>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="empty">No forms yet — create one to start collecting submissions.</p>
      {/if}

      {#if data.canManage}
        <form method="POST" action="?/createForm" use:enhance class="mt-4">
          <Field label="Form name" id="name"><input id="name" name="name" required placeholder="Contact us" /></Field>
          <label class="forms-check"><input type="checkbox" name="requireTurnstile" /> Require Turnstile (spam protection)</label>
          <Button type="submit" variant="primary">Create form</Button>
        </form>
      {/if}
    </Card>

    <Card>
      <h2>Submissions</h2>
      {#if !data.selectedFormId}
        <p class="empty">Pick a form's “View submissions” to see its intake here.</p>
      {:else if data.submissions.length > 0}
        <ul class="list" role="list">
          {#each data.submissions as sub}
            <li class="list-item sub-item">
              <span class="sub-values">{preview(sub.values)}</span>
              <span class="sub-meta">{when(sub.submittedAt)}</span>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="empty">No submissions for this form yet.</p>
      {/if}
    </Card>
  </div>
</main>

<style>
  .forms-view {
    font-size: 0.82rem;
    color: var(--color-ink-soft);
  }
  .forms-view.is-active {
    color: var(--color-act);
    font-weight: 600;
  }
  .forms-check {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-block: 10px 14px;
    font-size: 0.88rem;
    color: var(--color-ink-soft);
  }
  .sub-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .sub-values {
    font-size: 0.88rem;
  }
  .sub-meta {
    font-size: 0.74rem;
    font-family: var(--font-mono);
    color: var(--color-ink-faint);
  }
  .empty {
    color: var(--color-ink-faint);
    font-size: 0.9rem;
  }
</style>
