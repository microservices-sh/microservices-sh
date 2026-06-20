// Live research handler for the preview harness (dev mode only). Loaded via
// vite's ssrLoadModule from the dev middleware, so it runs in Node — real
// /last30days engine + the real module. Replaces the standalone dev/server.ts:
// the standard DS harness now also runs live.
import { spawn } from "node:child_process";
import { runResearch, createMemoryMarketingStore, type Synthesizer } from "@microservices-sh/marketing-research";
import { createLast30daysListenPort, type Last30daysRunner } from "@microservices-sh/marketing-research/adapters/last30days";

const SKILL_DIR =
  process.env.L30_SKILL_DIR ?? "/home/ubuntu/.claude/plugins/cache/last30days-skill/last30days/3.6.0/skills/last30days";
const PYTHON = process.env.L30_PYTHON ?? "python3";

const runner: Last30daysRunner = ({ topic, channels }) =>
  new Promise((resolve, reject) => {
    const args = [`${SKILL_DIR}/scripts/last30days.py`, topic, "--emit=compact"];
    if (channels?.length) args.push(`--subreddits=${channels.join(",")}`);
    const p = spawn(PYTHON, args, { env: { ...process.env, LAST30DAYS_NATIVE_SEARCH: "0" } });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", () => {});
    p.on("error", reject);
    p.on("close", () => (out.includes("EVIDENCE FOR SYNTHESIS") ? resolve(out) : reject(new Error("engine returned no evidence block"))));
  });

// Deterministic stand-in for the ai-gateway synthesizer (no LLM key in dev).
const synth: Synthesizer = {
  async synthesize({ signals }) {
    const top = signals.slice(0, 6);
    return {
      summary: `Surfaced ${signals.length} grounded signals; citing the top ${top.length}.`,
      implications: top.map((s) => `[${s.source}] ${s.title}`),
      citedSourceUrls: top.map((s) => s.sourceUrl)
    };
  }
};

const store = createMemoryMarketingStore();
const listen = createLast30daysListenPort({ run: runner });

export async function research(topic: string, channels: string[]) {
  const res = await runResearch(
    { topic, channels: channels.length ? channels : undefined },
    { store, listen, synthesizer: synth, now: () => Date.now(), actor: { id: "founder", scopes: ["marketing.run"] } }
  );
  return res.ok ? { brief: res.data.brief } : { refused: res.error, status: res.status };
}
