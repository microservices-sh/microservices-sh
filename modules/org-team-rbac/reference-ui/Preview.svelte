<!--
  Org & Team RBAC surface — explains and demonstrates what the module does (manage
  members, roles and invitations within an org, and authorize actions against each
  member's role permissions). Built on the shared DS; members/roles/invites +
  handlers are host-supplied. The permission checker runs the module's REAL
  hasPermission (wildcard-aware), so what it shows is exactly what authorize()
  enforces server-side. Reused by the harness and template routes.
-->
<script lang="ts">
  import { Eyebrow, Button } from "@microservices-sh/ui";
  import { hasPermission } from "@microservices-sh/org-team-rbac/authz";

  type Role = { id: string; name: string; permissions: string[] };
  type Member = { id: string; userId: string; roleId: string; status: "active" | "removed" };
  type Invitation = { id: string; email: string; roleId: string; status: "pending" | "accepted" | "revoked" | "expired" };

  let {
    roles = [],
    members = [],
    invitations = [],
    busy = false,
    oninvite,
    onaccept,
    onremove,
    onrole
  }: {
    roles?: Role[];
    members?: Member[];
    invitations?: Invitation[];
    busy?: boolean;
    oninvite?: (input: { email: string; roleId: string }) => void;
    onaccept?: (invitationId: string) => void;
    onremove?: (memberId: string) => void;
    onrole?: (memberId: string, roleId: string) => void;
  } = $props();

  const role = (id: string) => roles.find((r) => r.id === id) ?? null;
  const roleName = (id: string) => role(id)?.name ?? "—";

  let inviteEmail = $state("sam@acme.co");
  let inviteRoleId = $state("");
  $effect(() => { if (!inviteRoleId && roles.length) inviteRoleId = roles.find((r) => r.name === "member")?.id ?? roles[0].id; });

  // Live authorization check — uses the module's real wildcard-aware matcher.
  const SAMPLE_PERMS = ["org.read", "org.manage", "member.manage", "billing.refund"];
  let checkMemberId = $state("");
  let checkPerm = $state("member.manage");
  $effect(() => { if (!checkMemberId && members.length) checkMemberId = members[0].id; });
  const checkMember = $derived(members.find((m) => m.id === checkMemberId) ?? null);
  const effectivePerms = $derived(checkMember && checkMember.status === "active" ? role(checkMember.roleId)?.permissions ?? [] : []);
  const allowed = $derived(hasPermission(effectivePerms, checkPerm));

  const pendingInvites = $derived(invitations.filter((i) => i.status === "pending"));

  function invite(e: Event) {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteRoleId) return;
    oninvite?.({ email: inviteEmail.trim(), roleId: inviteRoleId });
  }
</script>

<header class="rb-head">
  <Eyebrow>Org &amp; team · RBAC</Eyebrow>
  <h1 class="rb-title">Org &amp; Team RBAC</h1>
  <p class="rb-lede">Manage members, roles and invitations inside an org — then <strong>authorize every action against the member's role permissions</strong>, not a flat <code>role === "admin"</code> string. Wildcards are supported, so <code>owner</code> holds <code>*</code> and access always resolves member → role → permissions.</p>
  <ol class="rb-how">
    <li><span class="rb-how__n mono">01</span><span><strong>Invite</strong> — email + role; emits <code>member.invited</code>, then <code>member.joined</code> on accept.</span></li>
    <li><span class="rb-how__n mono">02</span><span><strong>Assign roles</strong> — each role is a named permission set; changing one emits <code>role.updated</code>.</span></li>
    <li><span class="rb-how__n mono">03</span><span><strong>Authorize</strong> — resolve permissions and match (wildcard-aware); non-members resolve to <code>[]</code>.</span></li>
  </ol>
</header>

<section class="rb-grid">
  <div class="rb-panel">
    <p class="rb-label">Members <span class="mono">({members.filter((m) => m.status === "active").length})</span></p>
    <ul class="rb-members">
      {#each members as m (m.id)}
        <li class="rb-member" class:removed={m.status === "removed"}>
          <span class="rb-avatar" aria-hidden="true">{m.userId.replace(/^user_/, "").slice(0, 2).toUpperCase()}</span>
          <span class="rb-member__main">
            <span class="rb-member__id">{m.userId}</span>
            <span class="rb-member__perms mono">{(role(m.roleId)?.permissions ?? []).join(" · ")}</span>
          </span>
          {#if m.status === "active"}
            <select class="rb-rolesel" value={m.roleId} disabled={busy} onchange={(e) => onrole?.(m.id, (e.target as HTMLSelectElement).value)}>
              {#each roles as r}<option value={r.id}>{r.name}</option>{/each}
            </select>
            <button type="button" class="rb-remove" aria-label="Remove member" onclick={() => onremove?.(m.id)}>×</button>
          {:else}
            <span class="rb-pill rb-pill--removed">removed</span>
          {/if}
        </li>
      {/each}
    </ul>

    <form class="rb-invite" onsubmit={invite}>
      <input bind:value={inviteEmail} type="email" placeholder="teammate@email" aria-label="Invite email" />
      <select bind:value={inviteRoleId} aria-label="Invite role">
        {#each roles as r}<option value={r.id}>{r.name}</option>{/each}
      </select>
      <Button type="submit" variant="ghost">Invite</Button>
    </form>

    {#if pendingInvites.length}
      <ul class="rb-invites">
        {#each pendingInvites as inv (inv.id)}
          <li class="rb-inv">
            <span class="rb-inv__email">{inv.email}</span>
            <span class="rb-inv__role mono">{roleName(inv.roleId)}</span>
            <span class="rb-pill rb-pill--pending">pending</span>
            <button type="button" class="rb-accept" onclick={() => onaccept?.(inv.id)}>Accept</button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  <div class="rb-panel rb-check">
    <p class="rb-label">Authorize <em>· hasPermission</em></p>
    <div class="rb-check__row">
      <label class="rb-ctl"><span>Member</span>
        <select bind:value={checkMemberId}>
          {#each members as m}<option value={m.id}>{m.userId} ({roleName(m.roleId)}{m.status === "removed" ? ", removed" : ""})</option>{/each}
        </select>
      </label>
      <label class="rb-ctl"><span>Permission</span>
        <select bind:value={checkPerm}>
          {#each SAMPLE_PERMS as p}<option value={p}>{p}</option>{/each}
        </select>
      </label>
    </div>

    <div class="rb-verdict" class:allow={allowed}>
      <span class="rb-verdict__ico" aria-hidden="true">{allowed ? "✓" : "✕"}</span>
      <span class="rb-verdict__txt">
        {#if allowed}Allowed — <span class="mono">authorize</span> returns 200{:else}Forbidden — <span class="mono">authorize</span> returns 403{/if}
      </span>
    </div>
    <p class="rb-resolve mono">
      effective: {effectivePerms.length ? `[${effectivePerms.join(", ")}]` : "[] (non-member)"}
    </p>
  </div>
</section>

<style>
  .rb-head { margin-bottom: 1.5rem; }
  .rb-title { font-family: var(--font-display); font-weight: 800; font-size: clamp(1.7rem, 3vw, 2.3rem); letter-spacing: -0.02em; margin: 0.35rem 0 0.5rem; }
  .rb-lede { color: var(--color-ink-soft); max-width: 66ch; margin: 0 0 0.9rem; font-size: 1rem; }
  .rb-lede strong { color: var(--color-ink); font-weight: 600; }
  .rb-lede code, .rb-how code { font-family: var(--font-mono); color: var(--color-green); font-size: 0.86em; }
  .rb-how { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; max-width: 72ch; }
  .rb-how li { display: grid; grid-template-columns: auto 1fr; gap: 0.7rem; align-items: baseline; font-size: 0.9rem; color: var(--color-ink-soft); }
  .rb-how strong { color: var(--color-ink); font-weight: 600; }
  .rb-how__n { color: var(--color-green); font-size: 0.72rem; }

  .rb-grid { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 1rem; align-items: start; }
  @media (max-width: 760px) { .rb-grid { grid-template-columns: 1fr; } }
  .rb-panel { border: 1px solid var(--color-line-strong); border-radius: 14px; background: linear-gradient(180deg, var(--color-panel), var(--color-panel-subtle)); padding: 1rem 1.1rem; }
  .rb-label { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.07em; color: var(--color-ink-faint); font-weight: 600; margin: 0 0 0.7rem; }
  .rb-label em { font-style: normal; opacity: 0.7; text-transform: none; letter-spacing: 0; }

  .rb-members { list-style: none; margin: 0 0 0.8rem; padding: 0; display: grid; gap: 0.4rem; }
  .rb-member { display: grid; grid-template-columns: auto 1fr auto auto; align-items: center; gap: 0.6rem; background: var(--color-paper); border: 1px solid var(--color-line-strong); border-radius: 10px; padding: 0.5rem 0.65rem; }
  .rb-member.removed { opacity: 0.55; }
  .rb-avatar { width: 1.8rem; height: 1.8rem; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.72rem; color: #fff; background: linear-gradient(135deg, var(--color-green), color-mix(in srgb, var(--color-green) 55%, #6366f1)); flex: none; }
  .rb-member__main { display: grid; min-width: 0; }
  .rb-member__id { font-weight: 600; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rb-member__perms { font-size: 0.68rem; color: var(--color-ink-faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rb-rolesel { background: var(--color-paper); border: 1px solid var(--color-line-strong); color: var(--color-ink); border-radius: 7px; padding: 0.3rem 0.45rem; font: inherit; font-size: 0.78rem; }
  .rb-rolesel:focus { outline: none; border-color: var(--color-green); }
  .rb-remove { font: inherit; font-size: 1.05rem; line-height: 1; background: transparent; border: none; color: var(--color-ink-faint); cursor: pointer; padding: 0 0.15rem; }
  .rb-remove:hover { color: #9b2c2c; }

  .rb-invite { display: flex; gap: 0.5rem; margin-bottom: 0.7rem; }
  .rb-invite input { flex: 1 1 auto; min-width: 0; }
  .rb-invite input, .rb-invite select { background: var(--color-paper); border: 1px solid var(--color-line-strong); color: var(--color-ink); border-radius: 8px; padding: 0.45rem 0.6rem; font: inherit; font-size: 0.85rem; }
  .rb-invite input:focus, .rb-invite select:focus { outline: none; border-color: var(--color-green); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-green) 16%, transparent); }

  .rb-invites { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.35rem; }
  .rb-inv { display: grid; grid-template-columns: 1fr auto auto auto; align-items: center; gap: 0.6rem; font-size: 0.82rem; background: var(--color-paper); border: 1px dashed var(--color-line-strong); border-radius: 9px; padding: 0.45rem 0.6rem; }
  .rb-inv__email { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rb-inv__role { font-size: 0.72rem; color: var(--color-ink-faint); }
  .rb-accept { font: inherit; font-size: 0.74rem; background: transparent; border: 1px solid var(--color-line-strong); color: var(--color-green); border-radius: 7px; padding: 0.25rem 0.5rem; cursor: pointer; }
  .rb-accept:hover { border-color: var(--color-green); }

  .rb-pill { font-family: var(--font-mono); font-size: 0.64rem; text-transform: uppercase; letter-spacing: 0.04em; padding: 0.18rem 0.45rem; border-radius: 999px; }
  .rb-pill--pending { color: #b45309; background: #fdecc8; }
  .rb-pill--removed { color: #9b2c2c; background: #fde8e8; }

  .rb-check__row { display: flex; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 0.8rem; }
  .rb-ctl { display: grid; gap: 0.25rem; flex: 1 1 130px; }
  .rb-ctl span { font-size: 0.64rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-ink-faint); font-weight: 600; }
  .rb-ctl select { width: 100%; background: var(--color-paper); border: 1px solid var(--color-line-strong); color: var(--color-ink); border-radius: 8px; padding: 0.45rem 0.6rem; font: inherit; font-size: 0.84rem; }
  .rb-ctl select:focus { outline: none; border-color: var(--color-green); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-green) 16%, transparent); }

  .rb-verdict { display: flex; align-items: center; gap: 0.6rem; border-radius: 10px; padding: 0.7rem 0.85rem; border: 1px solid color-mix(in srgb, #ef4444 30%, transparent); background: color-mix(in srgb, #ef4444 8%, transparent); }
  .rb-verdict.allow { border-color: color-mix(in srgb, var(--color-green) 35%, transparent); background: color-mix(in srgb, var(--color-green) 9%, transparent); }
  .rb-verdict__ico { width: 1.5rem; height: 1.5rem; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; color: #fff; background: #ef4444; flex: none; }
  .rb-verdict.allow .rb-verdict__ico { background: var(--color-green); }
  .rb-verdict__txt { font-size: 0.86rem; font-weight: 600; color: var(--color-ink); }
  .rb-verdict__txt .mono { font-weight: 400; color: var(--color-ink-faint); }
  .rb-resolve { font-size: 0.72rem; color: var(--color-ink-faint); margin: 0.6rem 0 0; word-break: break-word; }
</style>
