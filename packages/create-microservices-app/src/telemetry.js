// Anonymous, opt-out usage telemetry.
//
// Sends event NAME + a few non-identifying props only — never code, file paths,
// project names, env, or personal data. Used to measure create/install/check
// activation. Disable with MICROSERVICES_TELEMETRY=0 (or DO_NOT_TRACK=1).
//
// Fire-and-forget: a short timeout, every error swallowed. Telemetry must never
// slow, block, or break the CLI.

const API_URL = process.env.MICROSERVICES_API_URL || "https://api.microservices.sh";
const TIMEOUT_MS = 1500;

export function telemetryEnabled() {
  const v = String(process.env.MICROSERVICES_TELEMETRY ?? "").toLowerCase();
  if (v === "0" || v === "false" || v === "off" || v === "no") return false;
  const dnt = String(process.env.DO_NOT_TRACK ?? "").toLowerCase();
  if (dnt === "1" || dnt === "true") return false;
  return true;
}

let noticeShown = false;
export function telemetryNotice(json) {
  if (json || noticeShown || !telemetryEnabled()) return;
  noticeShown = true;
  process.stderr.write(
    "ℹ microservices collects anonymous usage to improve the tool — no code, paths, or personal data. Opt out: MICROSERVICES_TELEMETRY=0\n"
  );
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
