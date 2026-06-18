<script lang="ts">
  import { Badge, Button, Eyebrow } from "$lib/ui";
  import { aiWorkers } from "$lib/os-data";

  const groups = [
    { id: "operator", label: "Operator", workers: aiWorkers.filter((worker) => worker.group === "operator") },
    { id: "growth", label: "Growth", workers: aiWorkers.filter((worker) => worker.group === "growth") },
    { id: "academy", label: "Academy", workers: aiWorkers.filter((worker) => worker.group === "academy") },
    { id: "support", label: "Support", workers: aiWorkers.filter((worker) => worker.group === "support") }
  ];
</script>

<svelte:head>
  <title>AI team · DOT AI OS</title>
</svelte:head>

<main class="section team-page">
  <div class="team-head">
    <div>
      <Eyebrow>AI team</Eyebrow>
      <h1>One operator, visible digital workers.</h1>
      <p>
        The revamp carries over the upstream roster model: every worker needs a role, routing focus, skills, and proof
        of output. This page is the visible contract for future agent execution.
      </p>
    </div>
    <div class="team-summary">
      <div><span>Workers</span><strong>{aiWorkers.length}</strong></div>
      <div><span>Skills</span><strong>{aiWorkers.reduce((total, worker) => total + worker.skills.length, 0)}</strong></div>
    </div>
  </div>

  <section class="org-grid" aria-label="AI team groups">
    {#each groups as group}
      <div class="panel org-column">
        <div class="org-head">
          <Eyebrow>{group.label}</Eyebrow>
          <Badge>{group.workers.length}</Badge>
        </div>
        {#each group.workers as worker}
          <article class="worker-card">
            <div class="worker-mark">{worker.name.slice(0, 1)}</div>
            <div>
              <strong>{worker.name}</strong>
              <span>{worker.role}</span>
            </div>
            <p>{worker.focus}</p>
            <div class="skill-row">
              {#each worker.skills as skill}
                <Badge tone="neutral">{skill}</Badge>
              {/each}
            </div>
            <div class="last-output">
              <span>Latest output</span>
              <p>{worker.lastOutput}</p>
            </div>
          </article>
        {/each}
      </div>
    {/each}
  </section>

  <section class="panel handoff-panel">
    <div class="section-head">
      <div>
        <Eyebrow>Routing rule</Eyebrow>
        <h2>Handoff before execution</h2>
      </div>
      <Button size="sm">Prepare handoff</Button>
    </div>
    <p>
      Agents should receive the task, context links, constraints, expected artifact, and approval risk. Provider calls,
      calendar writes, and customer-visible replies remain approval-gated.
    </p>
  </section>
</main>

<style>
  .team-page,
  .team-head,
  .org-grid,
  .org-column,
  .worker-card,
  .skill-row {
    display: grid;
    gap: 18px;
  }
  .team-head {
    grid-template-columns: minmax(0, 1fr) minmax(220px, 300px);
    align-items: end;
  }
  .team-summary {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
  .team-summary div {
    display: grid;
    gap: 4px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-card);
    background: var(--color-surface);
    padding: 14px;
  }
  .team-summary span,
  .worker-card span,
  .last-output span {
    color: var(--color-muted);
    font-size: 0.82rem;
  }
  .team-summary strong {
    color: var(--color-ink);
    font-size: 1.4rem;
  }
  .org-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    align-items: start;
  }
  .org-column {
    padding: 16px;
  }
  .org-head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }
  .worker-card {
    grid-template-columns: 40px minmax(0, 1fr);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-control);
    background: var(--color-surface);
    padding: 14px;
  }
  .worker-mark {
    display: grid;
    place-items: center;
    inline-size: 36px;
    aspect-ratio: 1;
    border-radius: 10px;
    background: var(--color-accent-soft);
    color: var(--color-accent-strong);
    font-weight: 750;
  }
  .worker-card strong {
    color: var(--color-ink);
  }
  .worker-card p,
  .last-output {
    grid-column: 1 / -1;
    margin: 0;
  }
  .skill-row {
    grid-column: 1 / -1;
    grid-template-columns: repeat(auto-fit, minmax(90px, max-content));
    gap: 6px;
  }
  .last-output {
    border-block-start: 1px solid var(--color-line);
    padding-block-start: 10px;
  }
  .last-output p {
    margin-block-start: 4px;
  }
  @media (max-width: 1120px) {
    .org-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (max-width: 720px) {
    .team-head,
    .org-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
