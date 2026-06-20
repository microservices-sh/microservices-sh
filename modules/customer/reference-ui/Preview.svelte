<!--
  Customer surface — explains and demonstrates what the module does (keep one record
  per customer, upserted by email, emitting created/updated). Built on the shared
  DS; the customer list + handler are host-supplied. The key idea shown here is the
  upsert contract: saving an existing email UPDATES that record (customer.updated);
  a new email CREATES one (customer.created). Reused by the harness and templates.
-->
<script lang="ts">
  import { Eyebrow, Button } from "@microservices-sh/ui";

  type Customer = { id: string; name: string; email: string; phone: string | null; notes: string | null; updatedAt: string };

  let {
    customers = [],
    busy = false,
    onsave
  }: {
    customers?: Customer[];
    busy?: boolean;
    onsave?: (input: { name: string; email: string; phone: string | null; notes: string | null }) => void;
  } = $props();

  let name = $state("");
  let email = $state("");
  let phone = $state("");
  let notes = $state("");
  let result = $state<null | { created: boolean; email: string }>(null);

  // Upsert is keyed by email — so we can show, before saving, whether this will
  // create or update (the same rule the module applies server-side).
  const willUpdate = $derived(email.trim() !== "" && customers.some((c) => c.email === email.trim()));

  function load(c: Customer) {
    name = c.name; email = c.email; phone = c.phone ?? ""; notes = c.notes ?? ""; result = null;
  }
  function fresh() {
    name = ""; email = ""; phone = ""; notes = ""; result = null;
  }
  function save(e: Event) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    const created = !customers.some((c) => c.email === email.trim());
    onsave?.({ name: name.trim(), email: email.trim(), phone: phone.trim() || null, notes: notes.trim() || null });
    result = { created, email: email.trim() };
  }
</script>

<header class="cu-head">
  <Eyebrow>Customers</Eyebrow>
  <h1 class="cu-title">Customer</h1>
  <p class="cu-lede">One record per customer, <strong>upserted by email</strong> — saving a known email updates that record, a new email creates one. Every write is <strong>emitted as an event</strong> the rest of your app can react to.</p>
  <ol class="cu-how">
    <li><span class="cu-how__n mono">01</span><span><strong>Upsert</strong> — keyed by email; no duplicate records for the same person.</span></li>
    <li><span class="cu-how__n mono">02</span><span><strong>List</strong> — tenant-scoped directory of every customer.</span></li>
    <li><span class="cu-how__n mono">03</span><span><strong>Events</strong> — a new email emits <code>customer.created</code>; a known one emits <code>customer.updated</code>.</span></li>
  </ol>
</header>

<section class="cu-board" aria-label="Customers">
  <div class="cu-list-panel">
    <div class="cu-list-head">
      <p class="cu-label">Directory <span class="mono">({customers.length})</span></p>
      <button type="button" class="cu-newbtn" onclick={fresh}>+ New</button>
    </div>
    <ul class="cu-list">
      {#each customers as c (c.id)}
        <li>
          <button type="button" class="cu-row" class:on={c.email === email.trim()} onclick={() => load(c)}>
            <span class="cu-avatar" aria-hidden="true">{(c.name[0] ?? "?").toUpperCase()}</span>
            <span class="cu-row__main">
              <span class="cu-row__name">{c.name}</span>
              <span class="cu-row__email mono">{c.email}</span>
            </span>
          </button>
        </li>
      {:else}
        <li class="cu-empty">No customers yet.</li>
      {/each}
    </ul>
  </div>

  <div class="cu-form-panel">
    <p class="cu-label">{willUpdate ? "Edit customer" : "New customer"}</p>
    <form class="cu-form" onsubmit={save}>
      <label class="cu-f"><span>Name</span><input bind:value={name} placeholder="Ada Lovelace" /></label>
      <label class="cu-f"><span>Email <em class="cu-key">· key</em></span><input bind:value={email} type="email" placeholder="ada@example.com" /></label>
      <label class="cu-f"><span>Phone</span><input bind:value={phone} placeholder="+1 555 0100" /></label>
      <label class="cu-f"><span>Notes</span><textarea bind:value={notes} rows="2" placeholder="Context, preferences…"></textarea></label>
      <div class="cu-actions">
        <Button type="submit" variant="primary">{busy ? "Saving…" : willUpdate ? "Update →" : "Create →"}</Button>
        {#if email.trim()}<span class="cu-hint">{willUpdate ? "matches an existing email → update" : "new email → create"}</span>{/if}
      </div>
      {#if result}
        <p class="cu-result" class:created={result.created}>
          {result.created ? "Created" : "Updated"} <span class="mono">{result.email}</span> · emitted <code>customer.{result.created ? "created" : "updated"}</code>
        </p>
      {/if}
    </form>
  </div>
</section>

<style>
  .cu-head { margin-bottom: 1.5rem; }
  .cu-title { font-family: var(--font-display); font-weight: 800; font-size: clamp(1.7rem, 3vw, 2.3rem); letter-spacing: -0.02em; margin: 0.35rem 0 0.5rem; }
  .cu-lede { color: var(--color-ink-soft); max-width: 64ch; margin: 0 0 0.9rem; font-size: 1rem; }
  .cu-lede strong { color: var(--color-ink); font-weight: 600; }
  .cu-how { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; max-width: 68ch; }
  .cu-how li { display: grid; grid-template-columns: auto 1fr; gap: 0.7rem; align-items: baseline; font-size: 0.9rem; color: var(--color-ink-soft); }
  .cu-how strong { color: var(--color-ink); font-weight: 600; }
  .cu-how code { font-family: var(--font-mono); color: var(--color-green); font-size: 0.86em; }
  .cu-how__n { color: var(--color-green); font-size: 0.72rem; }

  .cu-board { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); gap: 1rem; align-items: start; }
  @media (max-width: 720px) { .cu-board { grid-template-columns: 1fr; } }
  .cu-list-panel, .cu-form-panel { border: 1px solid var(--color-line-strong); border-radius: 14px; background: linear-gradient(180deg, var(--color-panel), var(--color-panel-subtle)); padding: 1rem 1.1rem; }
  .cu-label { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.07em; color: var(--color-ink-faint); font-weight: 600; margin: 0 0 0.7rem; }
  .cu-list-head { display: flex; align-items: baseline; justify-content: space-between; }
  .cu-newbtn { font: inherit; font-size: 0.76rem; background: transparent; border: none; color: var(--color-green); cursor: pointer; padding: 0; }
  .cu-newbtn:hover { text-decoration: underline; }

  .cu-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.4rem; }
  .cu-row { width: 100%; display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 0.7rem; text-align: left; background: var(--color-paper); border: 1px solid var(--color-line-strong); border-radius: 10px; padding: 0.5rem 0.65rem; cursor: pointer; color: var(--color-ink); transition: border-color 0.15s, transform 0.15s; }
  .cu-row:hover { transform: translateY(-1px); }
  .cu-row.on { border-color: var(--color-green); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-green) 16%, transparent); }
  .cu-avatar { width: 1.9rem; height: 1.9rem; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.8rem; color: #fff; background: linear-gradient(135deg, var(--color-green), color-mix(in srgb, var(--color-green) 55%, #1d4ed8)); flex: none; }
  .cu-row__main { display: grid; min-width: 0; }
  .cu-row__name { font-weight: 600; font-size: 0.88rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cu-row__email { font-size: 0.74rem; color: var(--color-ink-faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cu-empty { color: var(--color-ink-faint); font-size: 0.85rem; }

  .cu-form { display: grid; gap: 0.7rem; }
  .cu-f { display: grid; gap: 0.25rem; }
  .cu-f span { font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-ink-faint); font-weight: 600; }
  .cu-key { color: var(--color-green); font-style: normal; }
  .cu-f input, .cu-f textarea { width: 100%; background: var(--color-paper); border: 1px solid var(--color-line-strong); color: var(--color-ink); border-radius: 8px; padding: 0.5rem 0.65rem; font: inherit; font-size: 0.88rem; resize: vertical; }
  .cu-f input:focus, .cu-f textarea:focus { outline: none; border-color: var(--color-green); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-green) 16%, transparent); }

  .cu-actions { display: flex; align-items: center; gap: 0.8rem; flex-wrap: wrap; margin-top: 0.2rem; }
  .cu-hint { font-size: 0.74rem; color: var(--color-ink-faint); }
  .cu-result { font-size: 0.8rem; color: var(--color-ink-soft); margin: 0.2rem 0 0; }
  .cu-result.created { color: var(--color-green); }
  .cu-result code { font-family: var(--font-mono); color: var(--color-green); font-size: 0.92em; }
</style>
