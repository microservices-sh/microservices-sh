<script lang="ts">
  // Shared design-system tokens + the canonical app shell. The preview renders
  // INSIDE the real AppShell (same one the ERP/SaaS templates use) — single
  // source of truth for shell + module surfaces, no hardcoded chrome.
  import "@microservices-sh/ui/tokens.css";
  import { AppShell, Button } from "@microservices-sh/ui";
  import { onMount } from "svelte";
  import MarketingResearchPreview from "@microservices-sh/marketing-research/preview";

  const DEMO_BRIEF = {
    topic: "Cloudflare Workers",
    summary: "Builders are hand-rolling the 30% (auth, multi-tenant, webhooks); cited 3 signals.",
    implications: [
      "[reddit] Porting multi-tenant RBAC by hand onto Workers + D1",
      "[reddit] Protect your project from day 0 (don't expose data)",
      "[reddit] How are you handling failed webhooks and async tasks?"
    ],
    citations: [
      { sourceUrl: "https://www.reddit.com/r/CloudFlare/comments/multitenant", title: "Porting multi-tenant RBAC by hand onto Workers + D1" },
      { sourceUrl: "https://www.reddit.com/r/Supabase/comments/protect", title: "Protect your project from day 0" },
      { sourceUrl: "https://www.reddit.com/r/SaaS/comments/webhooks", title: "How are you handling failed webhooks and async tasks?" }
    ],
    coverage: { searched: ["reddit", "hackernews"], returned: ["reddit"], note: "hackernews returned 0 (demo)" }
  };
  const DEMO_REFUSED = {
    code: "MARKETING_NO_SIGNALS",
    message: "No grounded signals for this topic.",
    coverage: { searched: ["reddit", "hackernews"], returned: [], note: "all sources returned 0" }
  };

  const MODULES = [{ id: "marketing-research", name: "Marketing Research", Preview: MarketingResearchPreview }];

  // Hash-based nav (no router): AppShell highlights the item whose href matches pathname.
  let pathname = $state(`/${MODULES[0].id}`);
  onMount(() => {
    const sync = () => (pathname = location.hash ? `/${location.hash.slice(1)}` : `/${MODULES[0].id}`);
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  });
  const activeId = $derived(pathname.replace(/^\//, "") || MODULES[0].id);
  const active = $derived(MODULES.find((m) => m.id === activeId) ?? MODULES[0]);

  const nav = [{ section: "Modules", items: MODULES.map((m) => ({ href: `#${m.id}`, label: m.name })) }];

  let brief = $state<any>(DEMO_BRIEF);
  let refused = $state<any>(null);
  let busy = $state(false);

  async function onrun(topic: string, channels: string[]) {
    busy = true;
    try {
      const r = await fetch("/api/research", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ topic, channels }) });
      if (!r.ok) throw new Error("no live backend");
      const out = await r.json();
      brief = out.brief ?? null;
      refused = out.refused ?? null;
    } catch {
      brief = { ...DEMO_BRIEF, topic, summary: `(demo — no live backend) signals for "${topic}".` };
      refused = null;
    }
    busy = false;
  }

  function showRefusalDemo() {
    refused = DEMO_REFUSED;
    brief = null;
  }
</script>

<AppShell {nav} {pathname} brandHref="#" footer={{ title: "Module Preview", subtitle: "@microservices-sh/ui" }} status="dev · demo synthesizer">
  {#snippet actions()}
    <Button variant="ghost" size="sm" onclick={showRefusalDemo}>Preview refusal</Button>
  {/snippet}
  {#key activeId}
    {@const Preview = active.Preview}
    <Preview {brief} {refused} {busy} {onrun} />
  {/key}
</AppShell>
