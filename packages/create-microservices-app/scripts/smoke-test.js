import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tempRoot = await mkdtemp(join(tmpdir(), "microservices-create-smoke-"));

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? packageRoot,
    encoding: options.encoding ?? "utf8",
    env: options.env ?? process.env,
    stdio: options.stdio ?? "pipe",
  });

  // Some sandboxes attach EPERM to result.error even when the child ran and returned a status.
  if (result.error && typeof result.status !== "number") {
    throw result.error;
  }

  if ((result.status ?? 1) !== 0) {
    throw new Error(
      [
        `Command failed: ${command} ${args.join(" ")}`,
        result.stdout ? `stdout:\n${result.stdout}` : "",
        result.stderr ? `stderr:\n${result.stderr}` : "",
      ]
        .filter(Boolean)
        .join("\n\n")
    );
  }

  return {
    ...result,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

// wrangler.jsonc legitimately allows // line comments, so strip them before
// parsing. Only handles whole-line comments, which is all the templates emit.
function parseJsonc(text) {
  const stripped = text
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
  return JSON.parse(stripped);
}

try {
  run("pnpm", ["run", "build"], { stdio: "inherit" });
  run("pnpm", ["pack", "--pack-destination", tempRoot], { stdio: "inherit" });

  const tarball = (await readdir(tempRoot)).find((entry) => entry.endsWith(".tgz"));
  if (!tarball) {
    throw new Error(`No tarball produced in ${tempRoot}.`);
  }

  const extractRoot = join(tempRoot, "package-extract");
  await rm(extractRoot, { recursive: true, force: true });
  await mkdir(extractRoot, { recursive: true });
  run("tar", ["-xzf", join(tempRoot, tarball), "-C", extractRoot], { stdio: "inherit" });

  const manifest = JSON.parse(readFileSync(join(extractRoot, "package", "package.json"), "utf8"));
  if (manifest.dependencies && Object.keys(manifest.dependencies).length > 0) {
    throw new Error(`Packed create package should not have runtime dependencies:\n${JSON.stringify(manifest, null, 2)}`);
  }

  const createEntrypoint = join(extractRoot, "package", "dist", "index.js");
  if (!existsSync(createEntrypoint)) {
    throw new Error(`Missing packed create entrypoint: ${createEntrypoint}`);
  }

  run("node", [createEntrypoint, "smoke-app", "--dir", tempRoot, "--no-install", "--json"], { stdio: "inherit" });
  run("node", [
    createEntrypoint,
    "sveltekit-smoke",
    "--dir",
    tempRoot,
    "--template",
    "booking-sveltekit",
    "--package-manager",
    "pnpm",
    "--no-install",
    "--json"
  ], { stdio: "inherit" });
  run("node", [createEntrypoint, "plan-only-smoke", "--dir", tempRoot, "--no-install", "--json", "--modules", "payment,email"], { stdio: "inherit" });
  run("node", [createEntrypoint, "--interactive", "--dir", tempRoot, "--no-install", "--json"], {
    env: {
      ...process.env,
      MICROSERVICES_CREATE_PROMPT_ANSWERS: JSON.stringify(["guided smoke", "1", "4,5", "", "1"]),
    },
  });
  const planOnlyRoot = join(tempRoot, "plan-only-smoke");
  if (!existsSync(join(planOnlyRoot, "package.json"))) {
    throw new Error(`Plan-only create command did not generate the expected app at ${planOnlyRoot}.`);
  }

  const guidedRoot = join(tempRoot, "guided-smoke");
  if (!existsSync(join(guidedRoot, "package.json"))) {
    throw new Error(`Interactive create command did not generate the expected app at ${guidedRoot}.`);
  }

  const appRoot = join(tempRoot, "smoke-app");
  if (!existsSync(join(appRoot, "package.json"))) {
    throw new Error(`Create command did not generate the expected app at ${appRoot}.`);
  }

  const svelteRoot = join(tempRoot, "sveltekit-smoke");
  if (!existsSync(join(svelteRoot, "package.json"))) {
    throw new Error(`SvelteKit create command did not generate the expected app at ${svelteRoot}.`);
  }
  if (!existsSync(join(svelteRoot, "modules", "customer", "package.json"))) {
    throw new Error("SvelteKit create command did not include the customer module source.");
  }
  if (!existsSync(join(svelteRoot, "modules", "booking", "package.json"))) {
    throw new Error("SvelteKit create command did not include the booking module source.");
  }
  for (const moduleId of ["audit-log", "auth", "gateway"]) {
    if (!existsSync(join(svelteRoot, "modules", moduleId, "package.json"))) {
      throw new Error(`SvelteKit create command did not include the ${moduleId} module source.`);
    }
  }

  const createBundle = readFileSync(createEntrypoint, "utf8");
  if (!createBundle.includes("localSetup") || !createBundle.includes("local\", \"setup")) {
    throw new Error("Packed create bundle should guide SvelteKit users through microservices local commands.");
  }

  const sveltePackage = JSON.parse(readFileSync(join(svelteRoot, "package.json"), "utf8"));
  const svelteBookingPackage = JSON.parse(readFileSync(join(svelteRoot, "modules", "booking", "package.json"), "utf8"));
  const svelteGatewayPackage = JSON.parse(readFileSync(join(svelteRoot, "modules", "gateway", "package.json"), "utf8"));
  for (const moduleId of ["audit-log", "auth", "booking", "customer", "gateway"]) {
    if (sveltePackage.dependencies?.[`@microservices-sh/${moduleId}`] !== `file:./modules/${moduleId}`) {
      throw new Error(`SvelteKit generated app should depend on local ${moduleId} module source.`);
    }
  }
  if (
    sveltePackage.scripts?.dev !== "node scripts/microservices.js local dev" ||
    sveltePackage.scripts?.["setup:local"] !== "node scripts/microservices.js local setup" ||
    sveltePackage.scripts?.["db:migrate:local"] !== "node scripts/microservices.js local migrate" ||
    sveltePackage.scripts?.["dev:local"] !== "node scripts/microservices.js local dev" ||
    sveltePackage.scripts?.["smoke:local"] !== "node scripts/microservices.js local smoke"
  ) {
    throw new Error("SvelteKit generated app should route local setup, migration, dev, and smoke scripts through the project CLI.");
  }
  if (
    sveltePackage.scripts?.["deploy:preview:dry-run"] !== "node scripts/microservices.js preview deploy --dry-run" ||
    sveltePackage.scripts?.["deploy:preview"] !== "node scripts/microservices.js preview deploy --confirm deploy" ||
    sveltePackage.scripts?.["db:migrate:preview"] !== "node scripts/microservices.js preview migrate --confirm migrate"
  ) {
    throw new Error("SvelteKit generated app should route preview deploy and remote migration scripts through the project CLI.");
  }
  const svelteCli = readFileSync(join(svelteRoot, "scripts", "microservices.js"), "utf8");
  if (!svelteCli.includes("\"DB\", \"--local\"") || !svelteCli.includes("microservices local setup") || !svelteCli.includes("preview bind --d1-id <id> --kv-id <id>")) {
    throw new Error("SvelteKit generated app CLI should own D1 migration and preview binding commands.");
  }
  if (svelteBookingPackage.dependencies?.["@microservices-sh/customer"] !== "file:../customer") {
    throw new Error("Embedded booking module should depend on local customer module source.");
  }
  if (svelteGatewayPackage.dependencies?.["@microservices-sh/auth"] !== "file:../auth") {
    throw new Error("Embedded gateway module should depend on local auth module source.");
  }
  const svelteWrangler = parseJsonc(readFileSync(join(svelteRoot, "wrangler.jsonc"), "utf8"));
  if (svelteWrangler.name !== "sveltekit-smoke") {
    throw new Error(`SvelteKit generated app should use the app slug as the Worker name. Got ${svelteWrangler.name}.`);
  }
  if (svelteWrangler.vars?.MICROSERVICES_APP_SLUG !== "sveltekit-smoke") {
    throw new Error("SvelteKit generated app should include MICROSERVICES_APP_SLUG in Wrangler vars.");
  }

  run("node", ["--check", "scripts/microservices.js"], { cwd: appRoot, stdio: "inherit" });
  run("node", ["scripts/microservices.js", "check", "--json"], { cwd: svelteRoot, stdio: "inherit" });
  const catalog = JSON.parse(readFileSync(join(appRoot, "docs", "modules", "catalog.json"), "utf8"));
  const lock = JSON.parse(readFileSync(join(appRoot, "microservices.lock.json"), "utf8"));
  if (!catalog.modules?.some((module) => module.id === "payment")) {
    throw new Error("Generated catalog is missing payment.");
  }
  if (!lock.modules?.some((module) => module.id === "booking")) {
    throw new Error("Generated lockfile is missing booking.");
  }

  run("node", ["scripts/microservices.js", "modules", "list", "--json"], { cwd: appRoot, stdio: "inherit" });
  run("node", ["scripts/microservices.js", "docs", "booking", "--json"], { cwd: appRoot, stdio: "inherit" });
  run("node", ["scripts/microservices.js", "add", "payment", "--plan", "--json"], { cwd: appRoot, stdio: "inherit" });
  run("node", ["scripts/microservices.js", "updates", "--json"], { cwd: appRoot, stdio: "inherit" });
  run("node", ["scripts/microservices.js", "upgrade", "booking", "--plan", "--json"], { cwd: appRoot, stdio: "inherit" });
  run("node", ["scripts/microservices.js", "check", "--json"], { cwd: appRoot, stdio: "inherit" });

  if (!process.env.KEEP_CREATE_SMOKE) {
    await rm(tempRoot, { recursive: true, force: true });
  }

  process.stdout.write("create-microservices-app smoke test passed\n");
} catch (error) {
  process.stderr.write(`create-microservices-app smoke test failed\nTemp root: ${tempRoot}\n${error.message}\n`);
  process.exitCode = 1;
}
