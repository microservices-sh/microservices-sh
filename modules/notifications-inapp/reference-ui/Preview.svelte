<!--
  In-App Notifications surface — explains and demonstrates what the module does
  (deliver per-user, polymorphic notifications to a feed with read/unread state and
  an unread count). Built on the shared DS; the feed + handlers are host-supplied.
  Every notification is addressed to ONE user with a `type` + `data` payload — there
  is no broadcast. The unread count is derived the same way the module computes it:
  notifications whose readAt IS NULL. Reused by the harness and template routes.
-->
<script lang="ts">
  import { Eyebrow, Button } from "@microservices-sh/ui";

  type Notif = { id: string; type: string; title: string; body: string; readAt: string | null; createdAt: string };

  let {
    notifications = [],
    busy = false,
    onnotify,
    onread,
    onreadall
  }: {
    notifications?: Notif[];
    busy?: boolean;
    onnotify?: (type: string) => void;
    onread?: (id: string) => void;
    onreadall?: () => void;
  } = $props();

  // Same definition the module's getUnreadCount uses: readAt IS NULL.
  const unread = $derived(notifications.filter((n) => n.readAt === null).length);

  // Per-type presentation for the polymorphic payload. Unknown types fall back to
  // a generic glyph — the module itself never interprets `type`/`data`.
  const META: Record<string, { icon: string; tint: string }> = {
    "booking.confirmed": { icon: "📅", tint: "#3b82f6" },
    "payment.received": { icon: "💸", tint: "#0c8f5a" },
    "invoice.paid": { icon: "🧾", tint: "#0c8f5a" },
    "mention": { icon: "💬", tint: "#8b5cf6" },
    "ticket.replied": { icon: "🎫", tint: "#f59e0b" }
  };
  const meta = (t: string) => META[t] ?? { icon: "🔔", tint: "#94a3b8" };

  const SAMPLE_TYPES = ["booking.confirmed", "payment.received", "mention", "ticket.replied"];
  let nextType = $state(0);
  function sendTest() {
    onnotify?.(SAMPLE_TYPES[nextType % SAMPLE_TYPES.length]);
    nextType += 1;
  }

  const ago = (iso: string) => {
    const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  };
</script>

<header class="nt-head">
  <Eyebrow>In-app notifications</Eyebrow>
  <h1 class="nt-title">In-App Notifications</h1>
  <p class="nt-lede">Deliver <strong>per-user</strong> notifications to a feed — each carries its own <strong>type + payload</strong> (booking, payment, mention…) so any event shape fits one table. The feed tracks <strong>read/unread</strong> state and an unread count.</p>
  <ol class="nt-how">
    <li><span class="nt-how__n mono">01</span><span><strong>Notify</strong> — one recipient, a polymorphic payload, optional dedup key; emits <code>notification.created</code>.</span></li>
    <li><span class="nt-how__n mono">02</span><span><strong>Feed</strong> — user-scoped list + unread count (notifications where <code>readAt</code> is null).</span></li>
    <li><span class="nt-how__n mono">03</span><span><strong>Read</strong> — open one or mark all; emits <code>notification.read</code>.</span></li>
  </ol>
</header>

<section class="nt-console" aria-label="Notification feed">
  <div class="nt-console__rail" aria-hidden="true"></div>

  <div class="nt-bar">
    <span class="nt-bell">
      <span class="nt-bell__ico" aria-hidden="true">🔔</span>
      {#if unread > 0}<span class="nt-bell__badge mono">{unread}</span>{/if}
      <span class="nt-bell__txt">{unread > 0 ? `${unread} unread` : "All caught up"}</span>
    </span>
    <span class="nt-bar__actions">
      <Button variant="ghost" disabled={busy} onclick={sendTest}>+ Send test</Button>
      <button type="button" class="nt-readall" disabled={!unread} onclick={() => onreadall?.()}>Mark all read</button>
    </span>
  </div>

  {#if notifications.length}
    <ul class="nt-list">
      {#each notifications as n (n.id)}
        <li>
          <button type="button" class="nt-item" class:unread={n.readAt === null} onclick={() => onread?.(n.id)} disabled={n.readAt !== null} aria-label={n.readAt === null ? "Mark read" : "Read"}>
            <span class="nt-item__ico" style={`--tint:${meta(n.type).tint}`}>{meta(n.type).icon}</span>
            <span class="nt-item__main">
              <span class="nt-item__top">
                <span class="nt-item__title">{n.title}</span>
                <span class="nt-item__type mono">{n.type}</span>
              </span>
              <span class="nt-item__body">{n.body}</span>
            </span>
            <span class="nt-item__meta">
              <span class="nt-item__time mono">{ago(n.createdAt)}</span>
              {#if n.readAt === null}<span class="nt-dot" aria-hidden="true"></span>{/if}
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="nt-empty">No notifications. Send a test to populate the feed.</p>
  {/if}
</section>

<style>
  .nt-head { margin-bottom: 1.5rem; }
  .nt-title { font-family: var(--font-display); font-weight: 800; font-size: clamp(1.7rem, 3vw, 2.3rem); letter-spacing: -0.02em; margin: 0.35rem 0 0.5rem; }
  .nt-lede { color: var(--color-ink-soft); max-width: 64ch; margin: 0 0 0.9rem; font-size: 1rem; }
  .nt-lede strong { color: var(--color-ink); font-weight: 600; }
  .nt-how { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; max-width: 70ch; }
  .nt-how li { display: grid; grid-template-columns: auto 1fr; gap: 0.7rem; align-items: baseline; font-size: 0.9rem; color: var(--color-ink-soft); }
  .nt-how strong { color: var(--color-ink); font-weight: 600; }
  .nt-how code { font-family: var(--font-mono); color: var(--color-green); font-size: 0.86em; }
  .nt-how__n { color: var(--color-green); font-size: 0.72rem; }

  .nt-console { position: relative; border: 1px solid var(--color-line-strong); border-radius: 14px; background: linear-gradient(180deg, var(--color-panel), var(--color-panel-subtle)); padding: 1.1rem 1.2rem 1.2rem 1.4rem; overflow: hidden; }
  .nt-console__rail { position: absolute; inset: 0 auto 0 0; width: 3px; background: linear-gradient(180deg, var(--color-green), transparent); opacity: 0.7; }

  .nt-bar { display: flex; align-items: center; justify-content: space-between; gap: 0.8rem; flex-wrap: wrap; margin-bottom: 0.9rem; }
  .nt-bell { display: inline-flex; align-items: center; gap: 0.5rem; position: relative; }
  .nt-bell__ico { font-size: 1.15rem; }
  .nt-bell__badge { position: absolute; top: -0.35rem; left: 0.7rem; background: #ef4444; color: #fff; font-size: 0.6rem; min-width: 1.05rem; height: 1.05rem; padding: 0 0.25rem; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; }
  .nt-bell__txt { font-size: 0.82rem; color: var(--color-ink-soft); font-weight: 600; }
  .nt-bar__actions { display: inline-flex; gap: 0.5rem; align-items: center; }
  .nt-readall { font: inherit; font-size: 0.78rem; background: transparent; border: 1px solid var(--color-line-strong); color: var(--color-ink-soft); border-radius: 8px; padding: 0.4rem 0.65rem; cursor: pointer; }
  .nt-readall:hover:not(:disabled) { border-color: var(--color-green); color: var(--color-green); }
  .nt-readall:disabled { opacity: 0.45; cursor: default; }

  .nt-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.4rem; }
  .nt-item { width: 100%; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 0.8rem; text-align: left; background: var(--color-paper); border: 1px solid var(--color-line-strong); border-radius: 11px; padding: 0.65rem 0.8rem; cursor: pointer; color: var(--color-ink); transition: border-color 0.15s, background 0.15s; }
  .nt-item:disabled { cursor: default; }
  .nt-item.unread { background: color-mix(in srgb, var(--color-green) 5%, var(--color-paper)); border-color: color-mix(in srgb, var(--color-green) 28%, var(--color-line-strong)); }
  .nt-item:hover.unread { border-color: var(--color-green); }
  .nt-item__ico { width: 2rem; height: 2rem; display: inline-flex; align-items: center; justify-content: center; font-size: 1rem; border-radius: 9px; background: color-mix(in srgb, var(--tint) 14%, transparent); border: 1px solid color-mix(in srgb, var(--tint) 30%, transparent); flex: none; }
  .nt-item__main { display: grid; min-width: 0; gap: 0.1rem; }
  .nt-item__top { display: flex; align-items: baseline; gap: 0.6rem; min-width: 0; }
  .nt-item__title { font-weight: 600; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .nt-item__type { font-size: 0.68rem; color: var(--color-ink-faint); flex: none; }
  .nt-item__body { font-size: 0.8rem; color: var(--color-ink-soft); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .nt-item__meta { display: inline-flex; align-items: center; gap: 0.5rem; flex: none; }
  .nt-item__time { font-size: 0.72rem; color: var(--color-ink-faint); }
  .nt-dot { width: 8px; height: 8px; border-radius: 999px; background: var(--color-green); flex: none; }
  .nt-empty { color: var(--color-ink-faint); font-size: 0.85rem; }
</style>
