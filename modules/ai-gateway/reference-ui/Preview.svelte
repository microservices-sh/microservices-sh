<!--
  AI Gateway surface — explains and demonstrates what the module does (one governed
  boundary for every model call: fail-closed authz, a per-tenant token budget, BYOK
  provider resolution, then metering + audit). Built on the shared DS; the actor /
  budget / provider state + handlers are host-supplied. The point shown here: the
  gate runs IN ORDER and fail-closed — missing scope is 403, an exhausted budget is
  429 *before* any provider spend, an unset BYOK key is 400. Reused by the harness.
-->
<script lang="ts">
  import { Eyebrow, Button } from "@microservices-sh/ui";

  type Call = { id: string; provider: string; model: string; status: number; code: string | null; inputTokens: number; outputTokens: number; at: string };

  let {
    provider = "anthropic",
    model = "claude-opus-4-8",
    hasInvokeScope = true,
    keyConfigured = true,
    usedTokens = 0,
    capTokens = 100_000,
    calls = [],
    busy = false,
    onrun,
    ontogglescope,
    ontogglekey
  }: {
    provider?: string;
    model?: string;
    hasInvokeScope?: boolean;
    keyConfigured?: boolean;
    usedTokens?: number;
    capTokens?: number;
    calls?: Call[];
    busy?: boolean;
    onrun?: (prompt: string) => void;
    ontogglescope?: () => void;
    ontogglekey?: () => void;
  } = $props();

  let prompt = $state("Summarize the Q2 board notes in two sentences.");

  const remaining = $derived(Math.max(0, capTokens - usedTokens));
  const pct = $derived(Math.min(100, Math.round((usedTokens / capTokens) * 100)));
  // The gate, in order — first failing stage wins (fail-closed).
  const gate = $derived([
    { key: "authz", label: "Authorized", ok: hasInvokeScope, fail: "403 · missing ai.invoke scope" },
    { key: "budget", label: "Within budget", ok: remaining > 0, fail: "429 · AI_BUDGET_EXCEEDED" },
    { key: "provider", label: "Provider configured (BYOK)", ok: keyConfigured, fail: "400 · key unset" }
  ]);
  const blockedBy = $derived(gate.find((g) => !g.ok) ?? null);

  const num = (n: number) => new Intl.NumberFormat("en").format(n);
  function codeTint(status: number): string {
    if (status === 200) return "#0c8f5a";
    if (status === 429) return "#f59e0b";
    return "#ef4444";
  }
  const when = (iso: string) => new Date(iso).toLocaleTimeString("en", { hour: "numeric", minute: "2-digit", second: "2-digit" });

  function run(e: Event) {
    e.preventDefault();
    if (!prompt.trim()) return;
    onrun?.(prompt.trim());
  }
</script>

<header class="ag-head">
  <Eyebrow>AI gateway</Eyebrow>
  <h1 class="ag-title">AI Gateway</h1>
  <p class="ag-lede">One <strong>governed boundary</strong> for every model call. Before a provider is ever touched, the gate runs <strong>fail-closed</strong>: missing scope is <code>403</code>, an exhausted budget is <code>429</code> <em>before any spend</em>, an unset BYOK key is <code>400</code> — then the call is <strong>metered and audited</strong>. research, decision and agents all egress through here.</p>
  <ol class="ag-how">
    <li><span class="ag-how__n mono">01</span><span><strong>Authorize</strong> — the actor must hold <code>ai.invoke</code>; no scope, no call.</span></li>
    <li><span class="ag-how__n mono">02</span><span><strong>Cap spend</strong> — a per-tenant token budget blocks the call before provider cost.</span></li>
    <li><span class="ag-how__n mono">03</span><span><strong>Meter</strong> — resolve the BYOK provider, run, then record token usage + an audit entry.</span></li>
  </ol>
</header>

<section class="ag-state" aria-label="Gateway state">
  <div class="ag-toggles">
    <button type="button" class="ag-tg" class:on={hasInvokeScope} role="switch" aria-checked={hasInvokeScope} aria-label="Toggle ai.invoke scope" onclick={() => ontogglescope?.()}>
      <span class="ag-tg__dot"></span><span class="ag-tg__lbl">ai.invoke scope</span>
    </button>
    <button type="button" class="ag-tg" class:on={keyConfigured} role="switch" aria-checked={keyConfigured} aria-label="Toggle BYOK provider key" onclick={() => ontogglekey?.()}>
      <span class="ag-tg__dot"></span><span class="ag-tg__lbl">BYOK key set</span>
    </button>
  </div>
  <div class="ag-budget">
    <div class="ag-budget__top">
      <span class="ag-budget__k">Tenant budget</span>
      <span class="ag-budget__v mono">{num(usedTokens)} / {num(capTokens)} tok</span>
    </div>
    <div class="ag-meter" class:full={remaining <= 0}><span class="ag-meter__fill" style={`width:${pct}%`}></span></div>
    <span class="ag-budget__rem mono">{remaining > 0 ? `${num(remaining)} remaining` : "exhausted → 429"}</span>
  </div>
</section>

<section class="ag-console" aria-label="Run a completion">
  <div class="ag-console__rail" aria-hidden="true"></div>
  <p class="ag-label">complete · <span class="mono">{provider}/{model}</span></p>

  <div class="ag-gate" role="list" aria-label="Gate">
    {#each gate as g, i}
      {@const upstreamOk = gate.slice(0, i).every((x) => x.ok)}
      <span class="ag-stage" class:ok={g.ok && upstreamOk} class:bad={!g.ok && upstreamOk} class:skip={!upstreamOk} role="listitem">
        <span class="ag-stage__ico">{g.ok ? "✓" : upstreamOk ? "✕" : "·"}</span>
        <span class="ag-stage__lbl">{g.label}</span>
        {#if !g.ok && upstreamOk}<span class="ag-stage__fail">{g.fail}</span>{/if}
      </span>
      {#if i < gate.length - 1}<span class="ag-arrow" aria-hidden="true">→</span>{/if}
    {/each}
  </div>

  <form class="ag-form" onsubmit={run}>
    <textarea bind:value={prompt} rows="2" aria-label="Prompt"></textarea>
    <Button type="submit" variant="primary" disabled={busy}>{busy ? "Running…" : blockedBy ? "Run (will be blocked) →" : "Run complete →"}</Button>
  </form>
</section>

<div class="ag-out">
  <p class="ag-out__h mono">Call log <span>({calls.length})</span> · metered + audited</p>
  {#if calls.length}
    <ul class="ag-calls">
      {#each calls as c (c.id)}
        <li class="ag-call">
          <span class="ag-call__code mono" style={`--tint:${codeTint(c.status)}`}>{c.status}</span>
          <span class="ag-call__main">
            <span class="ag-call__model mono">{c.provider}/{c.model}</span>
            {#if c.code}<span class="ag-call__err">{c.code}</span>{/if}
          </span>
          <span class="ag-call__tok mono">{c.status === 200 ? `${num(c.inputTokens)}→${num(c.outputTokens)} tok` : "0 tok"}</span>
          <span class="ag-call__when mono">{when(c.at)}</span>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="ag-empty">Run a completion to record a metered call.</p>
  {/if}
</div>

<style>
  .ag-head { margin-bottom: 1.5rem; }
  .ag-title { font-family: var(--font-display); font-weight: 800; font-size: clamp(1.7rem, 3vw, 2.3rem); letter-spacing: -0.02em; margin: 0.35rem 0 0.5rem; }
  .ag-lede { color: var(--color-ink-soft); max-width: 70ch; margin: 0 0 0.9rem; font-size: 1rem; }
  .ag-lede strong { color: var(--color-ink); font-weight: 600; }
  .ag-lede em { font-style: italic; }
  .ag-lede code, .ag-how code { font-family: var(--font-mono); color: var(--color-green); font-size: 0.86em; }
  .ag-how { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; max-width: 76ch; }
  .ag-how li { display: grid; grid-template-columns: auto 1fr; gap: 0.7rem; align-items: baseline; font-size: 0.9rem; color: var(--color-ink-soft); }
  .ag-how strong { color: var(--color-ink); font-weight: 600; }
  .ag-how__n { color: var(--color-green); font-size: 0.72rem; }

  .ag-state { display: grid; grid-template-columns: auto 1fr; gap: 1.2rem; align-items: center; border: 1px solid var(--color-line-strong); border-radius: 12px; background: var(--color-panel); padding: 0.9rem 1.1rem; margin-bottom: 1rem; }
  @media (max-width: 600px) { .ag-state { grid-template-columns: 1fr; } }
  .ag-toggles { display: grid; gap: 0.5rem; }
  .ag-tg { display: inline-flex; align-items: center; gap: 0.5rem; background: transparent; border: none; cursor: pointer; padding: 0; }
  .ag-tg__dot { width: 2rem; height: 1.15rem; border-radius: 999px; border: 1px solid var(--color-line-strong); background: var(--color-panel-subtle); position: relative; flex: none; transition: background 0.15s; }
  .ag-tg__dot::after { content: ""; position: absolute; top: 50%; left: 2px; transform: translateY(-50%); width: 0.85rem; height: 0.85rem; border-radius: 999px; background: #fff; transition: left 0.15s; }
  .ag-tg.on .ag-tg__dot { background: var(--color-green); border-color: var(--color-green); }
  .ag-tg.on .ag-tg__dot::after { left: calc(100% - 0.95rem); }
  .ag-tg__lbl { font-size: 0.82rem; color: var(--color-ink); font-family: var(--font-mono); }

  .ag-budget { display: grid; gap: 0.25rem; }
  .ag-budget__top { display: flex; justify-content: space-between; gap: 0.6rem; }
  .ag-budget__k { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-ink-faint); font-weight: 600; }
  .ag-budget__v { font-size: 0.8rem; color: var(--color-ink); }
  .ag-meter { height: 8px; border-radius: 999px; background: var(--color-panel-subtle); border: 1px solid var(--color-line-strong); overflow: hidden; }
  .ag-meter__fill { display: block; height: 100%; background: var(--color-green); transition: width 0.25s; }
  .ag-meter.full .ag-meter__fill { background: #ef4444; }
  .ag-budget__rem { font-size: 0.7rem; color: var(--color-ink-faint); }

  .ag-console { position: relative; border: 1px solid var(--color-line-strong); border-radius: 14px; background: linear-gradient(180deg, var(--color-panel), var(--color-panel-subtle)); padding: 1.1rem 1.2rem 1.2rem 1.4rem; overflow: hidden; margin-bottom: 1.4rem; }
  .ag-console__rail { position: absolute; inset: 0 auto 0 0; width: 3px; background: linear-gradient(180deg, var(--color-green), transparent); opacity: 0.7; }
  .ag-label { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.07em; color: var(--color-ink-faint); font-weight: 600; margin: 0 0 0.7rem; }

  .ag-gate { display: flex; align-items: center; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.9rem; }
  .ag-stage { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.78rem; border: 1px solid var(--color-line-strong); border-radius: 8px; padding: 0.35rem 0.6rem; background: var(--color-paper); }
  .ag-stage__ico { width: 1.1rem; height: 1.1rem; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; font-size: 0.66rem; font-weight: 700; color: #fff; background: var(--color-ink-faint); flex: none; }
  .ag-stage.ok { border-color: color-mix(in srgb, var(--color-green) 35%, var(--color-line-strong)); }
  .ag-stage.ok .ag-stage__ico { background: var(--color-green); }
  .ag-stage.bad { border-color: #ef4444; background: color-mix(in srgb, #ef4444 7%, var(--color-paper)); }
  .ag-stage.bad .ag-stage__ico { background: #ef4444; }
  .ag-stage.skip { opacity: 0.45; }
  .ag-stage__fail { font-family: var(--font-mono); font-size: 0.68rem; color: #9b2c2c; }
  .ag-arrow { color: var(--color-ink-faint); font-size: 0.8rem; }

  .ag-form { display: grid; gap: 0.6rem; }
  .ag-form textarea { width: 100%; background: var(--color-paper); border: 1px solid var(--color-line-strong); color: var(--color-ink); border-radius: 8px; padding: 0.55rem 0.7rem; font: inherit; font-size: 0.88rem; resize: vertical; }
  .ag-form textarea:focus { outline: none; border-color: var(--color-green); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-green) 16%, transparent); }

  .ag-out__h { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-ink-faint); margin: 0 0 0.6rem; }
  .ag-empty { color: var(--color-ink-faint); font-size: 0.85rem; }
  .ag-calls { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.3rem; }
  .ag-call { display: grid; grid-template-columns: auto 1fr auto auto; align-items: center; gap: 0.7rem; background: var(--color-paper); border: 1px solid var(--color-line-strong); border-radius: 9px; padding: 0.45rem 0.65rem; }
  .ag-call__code { font-size: 0.78rem; font-weight: 700; color: var(--tint); flex: none; }
  .ag-call__main { display: grid; min-width: 0; }
  .ag-call__model { font-size: 0.8rem; color: var(--color-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ag-call__err { font-size: 0.7rem; color: #9b2c2c; }
  .ag-call__tok { font-size: 0.72rem; color: var(--color-ink-faint); white-space: nowrap; }
  .ag-call__when { font-size: 0.68rem; color: var(--color-ink-faint); white-space: nowrap; }
</style>
