<!--
  Support Ticket surface — explains and demonstrates what the module does (capture a
  request, route it to an agent, and move it through its status lifecycle while
  emitting events). Built on the shared DS; the ticket queue + agents + handlers are
  host-supplied. The status row is the documented open -> pending -> resolved ->
  closed lifecycle; changing status emits status_changed in addition to updated.
  Reused by the module-preview harness and template routes.
-->
<script lang="ts">
  import { Eyebrow, Button } from "@microservices-sh/ui";

  type Status = "open" | "pending" | "resolved" | "closed";
  type Priority = "low" | "normal" | "high" | "urgent";
  type Agent = { id: string; name: string };
  type Ticket = { id: string; subject: string; description?: string; requesterEmail: string; status: Status; priority: Priority; assigneeId: string | null };

  let {
    agents = [],
    tickets = [],
    busy = false,
    oncreate,
    onstatus,
    onpriority,
    onassign
  }: {
    agents?: Agent[];
    tickets?: Ticket[];
    busy?: boolean;
    oncreate?: (t: { subject: string; requesterEmail: string; priority: Priority }) => void;
    onstatus?: (id: string, status: Status) => void;
    onpriority?: (id: string, priority: Priority) => void;
    onassign?: (id: string, assigneeId: string | null) => void;
  } = $props();

  const STATUSES: Status[] = ["open", "pending", "resolved", "closed"];
  const PRIORITIES: Priority[] = ["low", "normal", "high", "urgent"];

  let selectedId = $state<string>("");
  let subject = $state("Can't export my report to CSV");
  let email = $state("dana@acme.co");
  let priority = $state<Priority>("high");

  $effect(() => {
    if (!selectedId && tickets.length) selectedId = tickets[0].id;
  });
  const selected = $derived(tickets.find((t) => t.id === selectedId) ?? null);
  const agentName = (id: string | null) => agents.find((a) => a.id === id)?.name ?? "Unassigned";

  function create(e: Event) {
    e.preventDefault();
    if (!subject.trim() || !email.trim()) return;
    oncreate?.({ subject: subject.trim(), requesterEmail: email.trim(), priority });
    subject = "";
  }
</script>

<header class="st-head">
  <Eyebrow>Support</Eyebrow>
  <h1 class="st-title">Support Ticket</h1>
  <p class="st-lede">Capture a request, route it to an agent, and move it through a fixed <strong>open → pending → resolved → closed</strong> lifecycle — every change is recorded and <strong>emitted as an event</strong> for notifications and SLA timers.</p>
  <ol class="st-how">
    <li><span class="st-how__n mono">01</span><span><strong>Create</strong> — subject, requester, priority; emits <code>created</code>.</span></li>
    <li><span class="st-how__n mono">02</span><span><strong>Triage</strong> — assign an agent and set priority; emits <code>updated</code>.</span></li>
    <li><span class="st-how__n mono">03</span><span><strong>Resolve</strong> — advance status; a transition emits <code>status_changed</code> alongside <code>updated</code>.</span></li>
  </ol>
</header>

<section class="st-board" aria-label="Support queue">
  <div class="st-queue">
    <p class="st-label">Queue <span class="mono">({tickets.length})</span></p>
    <form class="st-new" onsubmit={create}>
      <input class="st-new__subj" bind:value={subject} placeholder="Subject" aria-label="Subject" />
      <div class="st-new__row">
        <input bind:value={email} type="email" placeholder="requester@email" aria-label="Requester email" />
        <select bind:value={priority} aria-label="Priority">
          {#each PRIORITIES as p}<option value={p}>{p}</option>{/each}
        </select>
        <Button type="submit" variant="ghost">+ New</Button>
      </div>
    </form>
    <ul class="st-list">
      {#each tickets as t (t.id)}
        <li>
          <button type="button" class="st-row" class:on={t.id === selectedId} onclick={() => (selectedId = t.id)}>
            <span class="st-prio st-prio--{t.priority}" title={`priority: ${t.priority}`}></span>
            <span class="st-row__main">
              <span class="st-row__subj">{t.subject}</span>
              <span class="st-row__who">{t.requesterEmail} · {agentName(t.assigneeId)}</span>
            </span>
            <span class="st-pill st-pill--{t.status}">{t.status}</span>
          </button>
        </li>
      {:else}
        <li class="st-empty">Queue is empty — create a ticket.</li>
      {/each}
    </ul>
  </div>

  <div class="st-detail">
    {#if selected}
      <p class="st-label">Ticket</p>
      <h2 class="st-d__subj">{selected.subject}</h2>
      <p class="st-d__req mono">{selected.requesterEmail}</p>
      {#if selected.description}<p class="st-d__desc">{selected.description}</p>{/if}

      <p class="st-flabel">Status <em>· lifecycle</em></p>
      <div class="st-seg" role="group" aria-label="Status">
        {#each STATUSES as s, i}
          <button type="button" class="st-seg__b st-seg__b--{s}" class:on={selected.status === s} disabled={busy} onclick={() => onstatus?.(selected.id, s)}>
            {s}{#if i < STATUSES.length - 1}<span class="st-seg__arr" aria-hidden="true">→</span>{/if}
          </button>
        {/each}
      </div>

      <div class="st-controls">
        <label class="st-ctl"><span>Priority</span>
          <select value={selected.priority} onchange={(e) => onpriority?.(selected.id, (e.target as HTMLSelectElement).value as Priority)}>
            {#each PRIORITIES as p}<option value={p}>{p}</option>{/each}
          </select>
        </label>
        <label class="st-ctl"><span>Assignee</span>
          <select value={selected.assigneeId ?? ""} onchange={(e) => { const v = (e.target as HTMLSelectElement).value; onassign?.(selected.id, v || null); }}>
            <option value="">Unassigned</option>
            {#each agents as a}<option value={a.id}>{a.name}</option>{/each}
          </select>
        </label>
      </div>
    {:else}
      <p class="st-empty">Select a ticket to triage it.</p>
    {/if}
  </div>
</section>

<style>
  .st-head { margin-bottom: 1.5rem; }
  .st-title { font-family: var(--font-display); font-weight: 800; font-size: clamp(1.7rem, 3vw, 2.3rem); letter-spacing: -0.02em; margin: 0.35rem 0 0.5rem; }
  .st-lede { color: var(--color-ink-soft); max-width: 64ch; margin: 0 0 0.9rem; font-size: 1rem; }
  .st-lede strong { color: var(--color-ink); font-weight: 600; }
  .st-how { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; max-width: 68ch; }
  .st-how li { display: grid; grid-template-columns: auto 1fr; gap: 0.7rem; align-items: baseline; font-size: 0.9rem; color: var(--color-ink-soft); }
  .st-how strong { color: var(--color-ink); font-weight: 600; }
  .st-how code { font-family: var(--font-mono); color: var(--color-green); font-size: 0.86em; }
  .st-how__n { color: var(--color-green); font-size: 0.72rem; }

  .st-board { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 1rem; align-items: start; }
  @media (max-width: 720px) { .st-board { grid-template-columns: 1fr; } }

  .st-queue, .st-detail { border: 1px solid var(--color-line-strong); border-radius: 14px; background: linear-gradient(180deg, var(--color-panel), var(--color-panel-subtle)); padding: 1rem 1.1rem; }
  .st-label { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.07em; color: var(--color-ink-faint); font-weight: 600; margin: 0 0 0.7rem; }

  .st-new { display: grid; gap: 0.5rem; margin-bottom: 0.9rem; }
  .st-new input, .st-new select { background: var(--color-paper); border: 1px solid var(--color-line-strong); color: var(--color-ink); border-radius: 8px; padding: 0.45rem 0.6rem; font: inherit; font-size: 0.85rem; }
  .st-new input:focus, .st-new select:focus { outline: none; border-color: var(--color-green); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-green) 16%, transparent); }
  .st-new__subj { width: 100%; }
  .st-new__row { display: flex; gap: 0.5rem; }
  .st-new__row input { flex: 1 1 auto; min-width: 0; }

  .st-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.4rem; }
  .st-row { width: 100%; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 0.7rem; text-align: left; background: var(--color-paper); border: 1px solid var(--color-line-strong); border-radius: 10px; padding: 0.55rem 0.7rem; cursor: pointer; color: var(--color-ink); transition: border-color 0.15s, transform 0.15s; }
  .st-row:hover { transform: translateY(-1px); }
  .st-row.on { border-color: var(--color-green); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-green) 16%, transparent); }
  .st-row__main { display: grid; min-width: 0; }
  .st-row__subj { font-weight: 600; font-size: 0.88rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .st-row__who { font-size: 0.74rem; color: var(--color-ink-faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .st-prio { width: 8px; height: 8px; border-radius: 999px; flex: none; }
  .st-prio--low { background: #94a3b8; }
  .st-prio--normal { background: #3b82f6; }
  .st-prio--high { background: #f59e0b; }
  .st-prio--urgent { background: #ef4444; }
  .st-empty { color: var(--color-ink-faint); font-size: 0.85rem; }

  .st-pill { font-family: var(--font-mono); font-size: 0.64rem; text-transform: uppercase; letter-spacing: 0.04em; padding: 0.18rem 0.45rem; border-radius: 999px; flex: none; }
  .st-pill--open { color: #1d4ed8; background: #dbe6fe; }
  .st-pill--pending { color: #b45309; background: #fdecc8; }
  .st-pill--resolved { color: #0c8f5a; background: #d8f6e8; }
  .st-pill--closed { color: #57606a; background: #e7ebf0; }

  .st-d__subj { font-size: 1.05rem; font-weight: 700; margin: 0 0 0.2rem; }
  .st-d__req { font-size: 0.78rem; color: var(--color-ink-faint); margin: 0 0 0.6rem; }
  .st-d__desc { font-size: 0.88rem; color: var(--color-ink-soft); margin: 0 0 0.9rem; }
  .st-flabel { font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-ink-faint); font-weight: 600; margin: 0.6rem 0 0.4rem; }
  .st-flabel em { font-style: normal; opacity: 0.7; text-transform: none; letter-spacing: 0; }

  .st-seg { display: flex; flex-wrap: wrap; gap: 0.3rem; }
  .st-seg__b { display: inline-flex; align-items: center; gap: 0.4rem; font: inherit; font-size: 0.78rem; text-transform: capitalize; background: var(--color-paper); border: 1px solid var(--color-line-strong); color: var(--color-ink-soft); border-radius: 8px; padding: 0.35rem 0.55rem; cursor: pointer; transition: border-color 0.15s, color 0.15s; }
  .st-seg__b:hover { border-color: color-mix(in srgb, var(--color-green) 40%, var(--color-line-strong)); }
  .st-seg__b.on { border-color: var(--color-green); color: var(--color-green); background: color-mix(in srgb, var(--color-green) 8%, var(--color-paper)); font-weight: 600; }
  .st-seg__arr { color: var(--color-ink-faint); margin-left: 0.1rem; }

  .st-controls { display: flex; gap: 0.7rem; flex-wrap: wrap; margin-top: 1rem; }
  .st-ctl { display: grid; gap: 0.25rem; flex: 1 1 130px; }
  .st-ctl span { font-size: 0.64rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-ink-faint); font-weight: 600; }
  .st-ctl select { width: 100%; background: var(--color-paper); border: 1px solid var(--color-line-strong); color: var(--color-ink); border-radius: 8px; padding: 0.45rem 0.6rem; font: inherit; font-size: 0.86rem; text-transform: capitalize; }
  .st-ctl select:focus { outline: none; border-color: var(--color-green); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-green) 16%, transparent); }
</style>
