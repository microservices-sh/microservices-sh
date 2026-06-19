// LIVE e2e — gated behind L30_LIVE=1 (spawns the real /last30days Python engine).
// Not part of normal CI (skipped unless the env flag is set). Run:
//   L30_LIVE=1 L30_SKILL_DIR=<...>/skills/last30days npx vitest run \
//     modules/marketing-research/src/adapters/last30days-listen.live.test.ts
import { describe, it, expect } from "vitest";
import { spawn } from "node:child_process";
import { createLast30daysListenPort, type Last30daysRunner } from "./last30days-listen";
import { runResearch, createMemoryMarketingStore, type Synthesizer } from "../index";

const LIVE = process.env.L30_LIVE === "1";
const SKILL_DIR = process.env.L30_SKILL_DIR ?? "";

const nodeRunner: Last30daysRunner = ({ topic, channels }) =>
  new Promise((resolve, reject) => {
    const args = [`${SKILL_DIR}/scripts/last30days.py`, topic, "--emit=compact"];
    if (channels?.length) args.push(`--subreddits=${channels.join(",")}`);
    const p = spawn(process.env.L30_PYTHON ?? "python3", args, {
      env: { ...process.env, LAST30DAYS_NATIVE_SEARCH: "0" }
    });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", () => {});
    p.on("error", reject);
    p.on("close", () => (out.includes("EVIDENCE FOR SYNTHESIS") ? resolve(out) : reject(new Error("no evidence block in output"))));
  });

// Deterministic stand-in for the ai-gateway synthesizer (no LLM key in sandbox):
// cite the top signals verbatim. Proves the live chain yields a grounded brief.
const topSignalsSynth: Synthesizer = {
  async synthesize({ signals }) {
    const top = signals.slice(0, 3);
    return {
      summary: `Top ${top.length} live signals for the topic.`,
      implications: top.map((s) => `${s.source}: ${s.title}`),
      citedSourceUrls: top.map((s) => s.sourceUrl)
    };
  }
};

describe.runIf(LIVE)("LIVE: /last30days -> parse -> runResearch", () => {
  it(
    "produces a cited brief from a real engine run",
    async () => {
      const listen = createLast30daysListenPort({ run: nodeRunner });
      const res = await runResearch(
        { topic: "Cloudflare Workers", channels: ["CloudFlare", "webdev"] },
        { store: createMemoryMarketingStore(), listen, synthesizer: topSignalsSynth, now: () => Date.parse("2026-06-19"), actor: { id: "founder", scopes: ["marketing.run"] } }
      );
      // eslint-disable-next-line no-console
      console.log("LIVE result:", res.status, res.ok ? JSON.stringify((res.data as any).brief, null, 2) : JSON.stringify((res as any).error));
      expect(res.status).toBe(201);
      if (res.ok) {
        const brief = (res.data as any).brief;
        expect(brief.citations.length).toBeGreaterThan(0);
        expect(brief.coverage.searched.length).toBeGreaterThan(0);
      }
    },
    240_000
  );
});
