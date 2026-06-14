const baseUrl = (process.argv[2] ?? process.env.MICROSERVICES_TEMPLATE_BASE_URL ?? "http://127.0.0.1:5174").replace(/\/$/, "");

async function fetchText(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();
  return { response, text };
}

async function request(path, init) {
  const result = await fetchText(path, init);
  if (!result.response.ok) {
    throw new Error(`${path} returned ${result.response.status}: ${result.text.slice(0, 240)}`);
  }
  return result;
}

function assertIncludes(name, text, expected) {
  if (!text.includes(expected)) {
    throw new Error(`${name} did not include expected text: ${expected}`);
  }
}

function printResult(checks) {
  process.stdout.write(`${JSON.stringify({ ok: true, baseUrl, checks }, null, 2)}\n`);
}

function handleError(error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}

async function main() {
  const checks = [];

  // Public marketing + auth pages are reachable without a session. The /app and
  // /admin trees are membership/super-admin gated, so they are not smoked here.
  const home = await request("/");
  assertIncludes("home", home.text, "Ship a multi-tenant SaaS");
  checks.push({ id: "route:/", status: "pass" });

  const signup = await request("/signup");
  assertIncludes("signup", signup.text, "Create your organization");
  checks.push({ id: "route:/signup", status: "pass" });

  const login = await request("/login");
  assertIncludes("login", login.text, "Log in to your workspace");
  checks.push({ id: "route:/login", status: "pass" });

  // /app redirects unauthenticated users to /login (303). Follow is disabled so
  // we can assert the gate rather than the destination.
  const appGate = await fetchText("/app", { redirect: "manual" });
  if (appGate.response.status !== 303 && appGate.response.status !== 302) {
    throw new Error(`/app expected an auth redirect, got ${appGate.response.status}`);
  }
  checks.push({ id: "route:/app:auth-redirect", status: "pass" });

  printResult(checks);
}

main().catch(handleError);
