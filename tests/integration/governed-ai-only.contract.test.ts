import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

// Governance guardrail: AI-provider egress is allowed ONLY inside the governed
// adapters. Everywhere else, AI must go through an injected client wrapped by the
// ai-gateway (authz `ai.invoke` + token budget + meter + audit) or, for image
// generation, the provider adapter behind the beforeGenerate hook chain + audit.
// A new module that calls a provider directly (ungoverned) fails this test.
//
// To approve a new governed egress adapter, add its modules-relative dir prefix
// to APPROVED_PREFIXES — deliberately, as a reviewed decision.

const MODULES = fileURLToPath(new URL("../../modules", import.meta.url));

const PROVIDER_EGRESS = /\bnew OpenAI\b|\bnew Anthropic\b|api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis/;

const APPROVED_PREFIXES = [
  "ai-gateway/src/adapters/", // the governed text egress itself
  "image-generation/src/adapters/" // image provider adapters (injected; governed via hooks + audit)
];

function walkTs(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walkTs(full));
    else if (full.endsWith(".ts") && !full.includes(".test.")) out.push(full);
  }
  return out;
}

// Drop // and * comment lines so a provider name in a doc-comment isn't flagged.
function code(text: string): string {
  return text
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join("\n");
}

describe("governance: no ungoverned AI provider calls", () => {
  it("every direct AI-provider egress lives in an approved governed adapter", () => {
    const violations: string[] = [];
    for (const file of walkTs(MODULES)) {
      if (!PROVIDER_EGRESS.test(code(readFileSync(file, "utf8")))) continue;
      const rel = file.slice(MODULES.length + 1); // e.g. "image-generation/src/adapters/gpt-image.ts"
      if (!APPROVED_PREFIXES.some((prefix) => rel.startsWith(prefix))) violations.push(rel);
    }
    expect(violations, `ungoverned AI provider call(s) — route through ai-gateway or an approved adapter:\n${violations.join("\n")}`).toEqual([]);
  });
});
