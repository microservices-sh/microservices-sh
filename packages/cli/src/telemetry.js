// Anonymous, opt-out usage telemetry.
//
// Sends event NAME + a few non-identifying props only — never code, file paths,
// project names, secrets, or personal data. Used to measure CLI activation
// and conversion funnels. Disable with MICROSERVICES_TELEMETRY=0 (or
// DO_NOT_TRACK=1). Always targets the production API, independent of the
// control-plane --api-url, and never blocks or breaks the CLI.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const API_URL = process.env.MICROSERVICES_API_URL || "https://api.microservices.sh";
const TIMEOUT_MS = 1500;
const CONFIG_DIR = process.env.MICROSERVICES_CONFIG_DIR || join(homedir(), ".microservices");
const NOTICE_MARKER = join(CONFIG_DIR, ".telemetry-notice");

export function telemetryEnabled() {
  const v = String(process.env.MICROSERVICES_TELEMETRY ?? "").toLowerCase();
  if (v === "0" || v === "false" || v === "off" || v === "no") return false;
  const dnt = String(process.env.DO_NOT_TRACK ?? "").toLowerCase();
  if (dnt === "1" || dnt === "true") return false;
  // CI/automation is not human usage — never count it in the activation funnel.
  const ci = String(process.env.CI ?? "").toLowerCase();
  if (ci === "true" || ci === "1") return false;
  return true;
}

// Shown once per machine (marker file in the config dir).
export function telemetryNotice(json) {
  if (json || !telemetryEnabled()) return;
  try {
    if (existsSync(NOTICE_MARKER)) return;
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(NOTICE_MARKER, "shown\n");
    process.stderr.write(
      "ℹ microservices collects anonymous usage to improve the tool — no code, paths, or personal data. Opt out: MICROSERVICES_TELEMETRY=0\n"
    );
  } catch {
    // Never let the notice break the CLI.
  }
}

export async function track(name, props = {}) {
  if (!telemetryEnabled()) return;
  try {
    await fetch(`${API_URL}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, props, session: "cli" }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    // Telemetry is best-effort; never surface failures.
  }
}
