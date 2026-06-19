# Marketing Research Reference UI

Admin:

- A topic input + optional channels (subreddits/sources) and a "Run research" action that calls `marketing.runResearch`.
- Render the returned **brief**: summary, implications, and **every citation as a clickable source link** — never show a claim without its source (cite-or-refuse, surfaced in the UI).
- Surface the **coverage report prominently and honestly**: which sources were searched vs. returned, and a visible note when sources returned zero (e.g. "Hacker News, Reddit returned 0"). Thin coverage must never read as completeness.
- Render the **refusal states** explicitly, not as empty results: `MARKETING_NO_SIGNALS` (nothing grounded the topic) and `MARKETING_UNCITED` (synthesis cited a source it wasn't given) — show the code + message so the operator trusts the tool.
- List recent briefs (`marketing.getBrief`), owner-scoped.
- Show signal-drift (`diffSignals`) once snapshotting lands.

Visitor:

- Not applicable. Marketing research is an authenticated operator workflow.

Agentic:

- `marketing.getBrief` is read-only; safe for agents.
- **Require approval before `marketing.runResearch`** — it fetches external signals (and, once wired, calls an AI provider via ai-gateway), so it has cost and egress side effects.
- Treat every brief as cited-or-refused: an agent must not present demand numbers or claims the brief did not ground in a real source.

Working example (live):

- Dev preview server: `dev/server.ts` — wires the real `/last30days` SocialListenPort adapter + `runResearch` behind this surface (dark/green branded). Run `npx tsx modules/marketing-research/dev/server.ts` → http://localhost:5390. This is the dev/dogfood demonstrator of the Admin surface above.

Template route (TODO):

- The conventional rendered surface is a SvelteKit route, e.g. `templates/saas-starter-sveltekit/src/routes/app/marketing-research/+page.svelte`, composing the module's RPC — to be added when the module graduates from dogfood tool to a template-rendered surface.
