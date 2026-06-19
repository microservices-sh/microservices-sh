// SocialListenPort adapter over the /last30days engine (Reddit/HN/GitHub …).
//
// This is the Node/CLI (dogfood) adapter: the engine is a local Python CLI, so
// the impure subprocess call is an INJECTED seam (`run`) and the parsing — the
// actual hard part — is a PURE, tested function. The module's runtime stays
// clean (no node types here), exactly like the hexagonal pattern elsewhere.
//
// Wiring the real runner at the CLI edge (Node, not in a Worker):
//
//   import { spawn } from "node:child_process";
//   const run = ({ topic, channels }) => new Promise((resolve, reject) => {
//     const args = [`${SKILL_DIR}/scripts/last30days.py`, topic, "--emit=compact"];
//     if (channels?.length) args.push(`--subreddits=${channels.join(",")}`);
//     const p = spawn("python3", args, { env: process.env });
//     let out = ""; p.stdout.on("data", d => (out += d));
//     p.on("close", () => out.includes("EVIDENCE FOR SYNTHESIS") ? resolve(out) : reject(new Error("no evidence")));
//   });
//   const port = createLast30daysListenPort({ run });

import type { Coverage, Signal, SocialListenPort } from "../index";

export type Last30daysRunner = (input: { topic: string; channels?: string[] }) => Promise<string>;

// Parses the engine's `--emit=compact` EVIDENCE block into grounded signals +
// an honest coverage report. Pure: same input string -> same output.
export function parseLast30daysOutput(stdout: string): { signals: Signal[]; coverage: Coverage } {
  const lines = stdout.split(/\r?\n/);
  const signals: Signal[] = [];
  const searched: string[] = [];
  const returned: string[] = [];

  let cur: { source: string; title: string; sourceUrl?: string; excerpt?: string; engagement?: number } | null = null;
  let inCoverage = false;

  const flush = () => {
    // Cite-or-refuse upstream: a signal with no URL cannot ground a claim — drop it.
    if (cur && cur.sourceUrl) {
      signals.push({
        source: cur.source,
        sourceUrl: cur.sourceUrl,
        title: cur.title,
        excerpt: cur.excerpt ?? "",
        ...(cur.engagement !== undefined ? { engagement: cur.engagement } : {})
      });
    }
    cur = null;
  };

  for (const line of lines) {
    if (/^##\s+Source Coverage/i.test(line)) {
      flush();
      inCoverage = true;
      continue;
    }
    if (inCoverage) {
      const m = line.match(/^\s*-\s*(.+?):\s*(\d+)\s*items?\b/i);
      if (m) {
        const name = m[1].trim();
        searched.push(name);
        if (Number(m[2]) > 0) returned.push(name);
      }
      continue;
    }

    // Item header, e.g. `1. [reddit] Agentic coding is boring AF`
    const header = line.match(/^\s*\d+\.\s+\[([a-z0-9_]+)\]\s+(.+?)\s*$/i);
    if (header) {
      flush();
      cur = { source: header[1].toLowerCase(), title: header[2].trim() };
      continue;
    }
    if (!cur) continue;

    const url = line.match(/^\s*-\s*URL:\s*(\S+)/i);
    if (url) {
      cur.sourceUrl = url[1];
      continue;
    }
    const ev = line.match(/^\s*-\s*Evidence:\s*(.+)$/i);
    if (ev) {
      cur.excerpt = ev[1].trim();
      continue;
    }
    const sc = line.match(/score:(\d+)/i);
    if (sc && cur.engagement === undefined) {
      cur.engagement = Number(sc[1]);
    }
  }
  flush();

  const coverage: Coverage = { searched, returned };
  const zero = searched.filter((s) => !returned.includes(s));
  if (zero.length) coverage.note = `${zero.join(", ")} returned 0`;
  return { signals, coverage };
}

// Wires the injected runner to the port. Keeping `run` injected means the port
// is fully testable with a captured fixture and never shells out under test.
export function createLast30daysListenPort(deps: { run: Last30daysRunner }): SocialListenPort {
  return {
    async listen({ topic, channels }) {
      const stdout = await deps.run({ topic, channels });
      return parseLast30daysOutput(stdout);
    }
  };
}
