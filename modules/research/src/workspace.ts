// Workspace config layer (Hermes runtime). The client's workspace is the Fly
// volume; alongside the corpus (/data/sources) a /data/workspace/ folder shapes
// the agent's identity, policy, domain context, and a few cosmetic knobs:
//
//   soul.md      identity / voice      ┐
//   policy.md    rules / refusal       │→ one `systemPreamble` (sectioned)
//   glossary.md  domain terms / facts  ┘
//   config.json  structured settings (name, tone, topK≤cap, citationStyle, opsTools)
//
// SECURITY: the preamble is ADDITIVE — it shapes style/scope but never replaces
// the grounding rules (the synthesizer sandwiches it between immutable rules).
// config.json is CLIENT-supplied, so it controls only cosmetic/retrieval knobs;
// `model` and `owner` are deliberately NOT read (operator-locked via Fly env),
// `topK` is capped, and `opsTools` is a request the runtime intersects with the
// box's granted scopes (narrow-only). Pure: the file reader is injected.

export const WORKSPACE_MAX_TOPK = 20; // operator cap; client can lower, not exceed.

export type WorkspaceSettings = {
  name?: string;
  tone?: string;
  topK?: number;
  citationStyle?: string;
  opsTools?: string[];
};

export type WorkspaceConfig = {
  systemPreamble: string;
  settings: WorkspaceSettings;
};

type Reader = (path: string) => Promise<string>;

const join = (dir: string, name: string) => `${dir.replace(/\/+$/, "")}/${name}`;

async function readOptional(read: Reader, path: string): Promise<string | undefined> {
  try {
    const text = await read(path);
    return text.trim() ? text.trim() : undefined;
  } catch {
    return undefined;
  }
}

function parseSettings(raw: string | undefined): WorkspaceSettings {
  if (!raw) return {};
  let obj: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    obj = parsed as Record<string, unknown>;
  } catch {
    return {};
  }
  const settings: WorkspaceSettings = {};
  if (typeof obj.name === "string") settings.name = obj.name;
  if (typeof obj.tone === "string") settings.tone = obj.tone;
  if (typeof obj.citationStyle === "string") settings.citationStyle = obj.citationStyle;
  if (typeof obj.topK === "number" && Number.isFinite(obj.topK)) {
    settings.topK = Math.min(WORKSPACE_MAX_TOPK, Math.max(1, Math.floor(obj.topK)));
  }
  if (Array.isArray(obj.opsTools)) {
    settings.opsTools = obj.opsTools.filter((t): t is string => typeof t === "string");
  }
  // `model` and `owner` intentionally ignored — operator-locked.
  return settings;
}

function assemblePreamble(
  files: { soul?: string; policy?: string; glossary?: string },
  settings: WorkspaceSettings
): string {
  const sections: string[] = [];
  const identity: string[] = [];
  if (settings.name) identity.push(`You are ${settings.name}.`);
  if (settings.tone) identity.push(`Preferred tone: ${settings.tone}.`);
  if (files.soul) identity.push(files.soul);
  if (identity.length) sections.push(`## Identity\n${identity.join("\n")}`);
  if (files.policy) sections.push(`## Operating policy\n${files.policy}`);
  if (files.glossary) sections.push(`## Glossary\n${files.glossary}`);
  return sections.join("\n\n");
}

export async function loadWorkspaceConfig(dir: string, deps: { read: Reader }): Promise<WorkspaceConfig> {
  const [soul, policy, glossary, configRaw] = await Promise.all([
    readOptional(deps.read, join(dir, "soul.md")),
    readOptional(deps.read, join(dir, "policy.md")),
    readOptional(deps.read, join(dir, "glossary.md")),
    readOptional(deps.read, join(dir, "config.json"))
  ]);
  const settings = parseSettings(configRaw);
  const systemPreamble = assemblePreamble({ soul, policy, glossary }, settings);
  return { systemPreamble, settings };
}
