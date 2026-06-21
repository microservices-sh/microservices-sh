import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadFrameworks } from "../src/framework-starter.js";

// Keep the smoke test hermetic: never emit usage telemetry to prod from a test
// run (child CLIs inherit this). CI already auto-opts-out, this also covers local.
process.env.MICROSERVICES_TELEMETRY = "0";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tempRoot = await mkdtemp(join(tmpdir(), "microservices-create-smoke-"));
const SKIP_BUILD = process.argv.includes("--skip-build") || process.env.MICROSERVICES_CREATE_SMOKE_SKIP_BUILD === "1";
const DEEP_STACKSUITE =
  process.argv.includes("--deep-stacksuite") || process.env.MICROSERVICES_CREATE_SMOKE_DEEP_STACKSUITE === "1";

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

function assertRepoTemplateScaffold(root, templateId, expectedModules) {
  if (!existsSync(join(root, "package.json"))) {
    throw new Error(`${templateId} create command did not generate package.json at ${root}.`);
  }
  if (!existsSync(join(root, "svelte.config.js"))) {
    throw new Error(`${templateId} create command did not generate the SvelteKit shell.`);
  }
  if (!existsSync(join(root, "scripts", "microservices.js"))) {
    throw new Error(`${templateId} create command did not include the project CLI.`);
  }

  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  for (const moduleId of expectedModules) {
    if (!existsSync(join(root, "modules", moduleId, "package.json"))) {
      throw new Error(`${templateId} create command did not include the ${moduleId} module source.`);
    }
    if (pkg.dependencies?.[`@microservices-sh/${moduleId}`] !== `link:./modules/${moduleId}`) {
      throw new Error(`${templateId} generated app should depend on local ${moduleId} module source.`);
    }
  }
  if (!existsSync(join(root, "packages", "connection-contract", "package.json"))) {
    throw new Error(`${templateId} create command did not include the connection-contract package source.`);
  }
  const packageRoot = join(root, "packages");
  if (existsSync(packageRoot)) {
    for (const entry of readdirSync(packageRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const packageJsonPath = join(packageRoot, entry.name, "package.json");
      if (!existsSync(packageJsonPath)) continue;
      const bundledPackage = JSON.parse(readFileSync(packageJsonPath, "utf8"));
      if (pkg.dependencies?.[bundledPackage.name] !== `link:./packages/${entry.name}`) {
        throw new Error(`${templateId} generated app should depend on local ${entry.name} package source.`);
      }
    }
  }
  assertNoWorkspaceRuntimeDeps(root, templateId);

  run("node", ["--check", "scripts/microservices.js"], { cwd: root, stdio: "inherit" });
  run("node", ["scripts/microservices.js", "check", "--json"], { cwd: root, stdio: "inherit" });
}

function assertGeneratedAppInstallBuild(root, templateId) {
  run("pnpm", ["install", "--ignore-scripts"], { cwd: root, stdio: "inherit" });
  run("pnpm", ["build"], { cwd: root, stdio: "inherit" });
  run("node", ["scripts/microservices.js", "check", "--json"], { cwd: root, stdio: "inherit" });
  process.stdout.write(`${templateId} generated app install/build smoke passed\n`);
}

function assertNoWorkspaceRuntimeDeps(root, label) {
  const packagePaths = [join(root, "package.json")];
  for (const area of ["modules", "packages"]) {
    const areaRoot = join(root, area);
    if (!existsSync(areaRoot)) continue;
    for (const entry of readdirSync(areaRoot, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const pkgPath = join(areaRoot, entry.name, "package.json");
        if (existsSync(pkgPath)) packagePaths.push(pkgPath);
      }
    }
  }

  const offenders = [];
  for (const pkgPath of packagePaths) {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    for (const field of ["dependencies", "optionalDependencies", "peerDependencies"]) {
      for (const [name, version] of Object.entries(pkg[field] ?? {})) {
        if (String(version).startsWith("workspace:")) {
          offenders.push(`${pkgPath}:${field}.${name}=${version}`);
        }
      }
    }
  }
  if (offenders.length) {
    throw new Error(`${label} generated app contains runtime workspace dependencies:\n${offenders.join("\n")}`);
  }
}

try {
  if (SKIP_BUILD) {
    run("node", ["--check", "dist/index.js"], { stdio: "inherit" });
  } else {
    run("pnpm", ["run", "build"], { stdio: "inherit" });
  }
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

  // booking-business (procedural / module-contract) — exercises catalog.json,
  // module list/docs/add/upgrade below. Pinned explicitly: the default template
  // is booking-sveltekit (covered separately as sveltekit-smoke).
  run("node", [createEntrypoint, "smoke-app", "--dir", tempRoot, "--template", "booking-business", "--no-install", "--json"], { stdio: "inherit" });
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
  // No --template → must resolve to the flagship default (booking-sveltekit).
  run("node", [createEntrypoint, "default-smoke", "--dir", tempRoot, "--no-install", "--json"], { stdio: "inherit" });
  run("node", [createEntrypoint, "plan-only-smoke", "--dir", tempRoot, "--template", "booking-business", "--no-install", "--json", "--modules", "payment,email"], { stdio: "inherit" });
  const privateDotAi = run("node", [
    createEntrypoint,
    "private-dot-ai-smoke",
    "--dir",
    tempRoot,
    "--template",
    "dot-ai-os",
    "--no-install",
    "--no-git",
    "--json"
  ]);
  const accountingErp = run("node", [
    createEntrypoint,
    "accounting-erp-smoke",
    "--dir",
    tempRoot,
    "--template",
    "accounting-erp-sveltekit",
    "--no-install",
    "--no-git",
    "--json"
  ]);
  const commerceOps = run("node", [
    createEntrypoint,
    "commerce-ops-smoke",
    "--dir",
    tempRoot,
    "--template",
    "commerce-ops-sveltekit",
    "--no-install",
    "--no-git",
    "--json"
  ]);
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

  const privateDotAiRoot = join(tempRoot, "private-dot-ai-smoke");
  if (!existsSync(join(privateDotAiRoot, "package.json"))) {
    throw new Error(`Private dot-ai-os create command did not generate the expected app at ${privateDotAiRoot}.`);
  }
  if (existsSync(join(privateDotAiRoot, "microservices.os.json"))) {
    throw new Error("Private dot-ai-os create command should not write microservices.os.json.");
  }
  const privateDotAiOutput = JSON.parse(privateDotAi.stdout);
  assert.strictEqual(privateDotAiOutput.data.template, "dot-ai-os");
  assert.ok(privateDotAiOutput.warnings.some((warning) => warning.includes("private-pilot template")));

  const accountingRoot = join(tempRoot, "accounting-erp-smoke");
  const accountingModules = [
    "admin-shell",
    "accounts-payable",
    "accounts-receivable",
    "accounting-core",
    "audit-log",
    "auth",
    "bank-reconciliation",
    "customer",
    "email",
    "estimate-quote",
    "file-media",
    "gateway",
    "identity",
    "invoice",
    "jobs-workflows",
    "notifications-inapp",
    "org-team-rbac",
    "payment",
    "recurring-documents",
    "support-ticket",
    "webhook-delivery",
  ];
  assertRepoTemplateScaffold(accountingRoot, "accounting-erp-sveltekit", accountingModules);
  const accountingOutput = JSON.parse(accountingErp.stdout);
  assert.strictEqual(accountingOutput.data.template, "accounting-erp-sveltekit");
  assert.ok(accountingOutput.data.modules.includes("identity"));
  assert.ok(accountingOutput.data.modules.includes("notifications-inapp"));
  if (DEEP_STACKSUITE) {
    assertGeneratedAppInstallBuild(accountingRoot, "accounting-erp-sveltekit");
  }

  const commerceRoot = join(tempRoot, "commerce-ops-smoke");
  const commerceModules = [
    "admin-shell",
    "audit-log",
    "auth",
    "commerce-sync",
    "customer",
    "email",
    "file-media",
    "gateway",
    "identity",
    "inventory",
    "invoice",
    "jobs-workflows",
    "notifications-inapp",
    "org-team-rbac",
    "payment",
    "product-catalog",
    "sales-order",
    "shipment",
    "support-ticket",
    "webhook-delivery",
  ];
  assertRepoTemplateScaffold(commerceRoot, "commerce-ops-sveltekit", commerceModules);
  const commerceOutput = JSON.parse(commerceOps.stdout);
  assert.strictEqual(commerceOutput.data.template, "commerce-ops-sveltekit");
  assert.ok(commerceOutput.data.modules.includes("identity"));
  assert.ok(commerceOutput.data.modules.includes("webhook-delivery"));
  if (DEEP_STACKSUITE) {
    assertGeneratedAppInstallBuild(commerceRoot, "commerce-ops-sveltekit");
  }

  const defaultRoot = join(tempRoot, "default-smoke");
  if (!existsSync(join(defaultRoot, "svelte.config.js"))) {
    throw new Error("Default template (no --template) must scaffold the SvelteKit flagship (booking-sveltekit).");
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
  for (const moduleId of ["audit-log", "auth", "email", "gateway", "payment"]) {
    if (!existsSync(join(svelteRoot, "modules", moduleId, "package.json"))) {
      throw new Error(`SvelteKit create command did not include the ${moduleId} module source.`);
    }
  }
  if (!existsSync(join(svelteRoot, "packages", "connection-contract", "package.json"))) {
    throw new Error("SvelteKit create command did not include the connection-contract package source.");
  }

  const createBundle = readFileSync(createEntrypoint, "utf8");
  if (!createBundle.includes("localSetup") || !createBundle.includes("local\", \"setup")) {
    throw new Error("Packed create bundle should guide SvelteKit users through microservices local commands.");
  }

  const sveltePackage = JSON.parse(readFileSync(join(svelteRoot, "package.json"), "utf8"));
  const svelteBookingPackage = JSON.parse(readFileSync(join(svelteRoot, "modules", "booking", "package.json"), "utf8"));
  const svelteGatewayPackage = JSON.parse(readFileSync(join(svelteRoot, "modules", "gateway", "package.json"), "utf8"));
  const svelteAuthPackage = JSON.parse(readFileSync(join(svelteRoot, "modules", "auth", "package.json"), "utf8"));
  const sveltePaymentPackage = JSON.parse(readFileSync(join(svelteRoot, "modules", "payment", "package.json"), "utf8"));
  for (const moduleId of ["audit-log", "auth", "booking", "customer", "email", "gateway", "payment"]) {
    if (sveltePackage.dependencies?.[`@microservices-sh/${moduleId}`] !== `link:./modules/${moduleId}`) {
      throw new Error(`SvelteKit generated app should depend on local ${moduleId} module source.`);
    }
  }
  if (svelteAuthPackage.dependencies?.["@microservices-sh/connection-contract"] !== "file:../../packages/connection-contract") {
    throw new Error("SvelteKit generated auth module should depend on local connection-contract package source.");
  }
  if (sveltePaymentPackage.dependencies?.["@microservices-sh/connection-contract"] !== "file:../../packages/connection-contract") {
    throw new Error("SvelteKit generated payment module should depend on local connection-contract package source.");
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
    sveltePackage.scripts?.["deploy:preview:plan"] !== "node scripts/microservices.js deploy preview --plan" ||
    sveltePackage.scripts?.["deploy:preview:dry-run"] !== "node scripts/microservices.js deploy preview --plan" ||
    sveltePackage.scripts?.["deploy:preview"] !== "node scripts/microservices.js deploy preview --confirm deploy" ||
    "provision:preview" in sveltePackage.scripts ||
    "db:migrate:preview" in sveltePackage.scripts
  ) {
    throw new Error("SvelteKit generated app should route managed preview deploy scripts through the project CLI without local remote migration/provision scripts.");
  }
  const svelteCli = readFileSync(join(svelteRoot, "scripts", "microservices.js"), "utf8");
  if (
    !svelteCli.includes("\"DB\", \"--local\"") ||
    !svelteCli.includes("appProfile.remoteApi === true") ||
    !svelteCli.includes("localRequiresD1") ||
    !svelteCli.includes("This remote-API app uses the hosted microservices.sh API") ||
    !svelteCli.includes("\"--config\", wranglerConfigPath") ||
    !svelteCli.includes("microservices deploy domain add") ||
    !svelteCli.includes("--hostname <host>") ||
    !svelteCli.includes("microservices local setup") ||
    !svelteCli.includes("deploy preview --confirm deploy") ||
    !svelteCli.includes("/deployments/preview") ||
    !svelteCli.includes("/deployments/${deploymentId}/migrate") ||
    !svelteCli.includes("/deployments/${deploymentId}/upload") ||
    !svelteCli.includes("/deployments/${deploymentId}/cleanup") ||
    !svelteCli.includes("production-migrate") ||
    !svelteCli.includes("production-upload") ||
    !svelteCli.includes("production-cleanup") ||
    !svelteCli.includes("buildDeployArtifact") ||
    !svelteCli.includes(".svelte-kit/cloudflare") ||
    !svelteCli.includes(".microservices/deploy-bundle") ||
    !svelteCli.includes("deploy:bundle") ||
    !svelteCli.includes("CI_API_KEY_REQUIRED") ||
    !svelteCli.includes("DEPLOYMENT_INPUT_INVALID") ||
    !svelteCli.includes("--input deployment.json") ||
    !svelteCli.includes("--target managed|cloudflare") ||
    !svelteCli.includes("--cloudflare-config") ||
    !svelteCli.includes("CLOUDFLARE_API_TOKEN") ||
    !svelteCli.includes("deploy run") ||
    svelteCli.includes("wrangler whoami") ||
    svelteCli.includes("preview bind --d1-id <id> --kv-id <id>") ||
    svelteCli.includes('resource === "preview"')
  ) {
    throw new Error("SvelteKit generated app CLI should keep local D1 setup but proxy preview deployment to the control-plane API.");
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
  // `add --plan` must be read-only: report a vendor plan without mutating the project.
  run("node", ["scripts/microservices.js", "add", "invoice", "--plan", "--json"], { cwd: svelteRoot, stdio: "inherit" });
  if (existsSync(join(svelteRoot, "modules", "invoice"))) {
    throw new Error("`add --plan` must not vendor the module — it created modules/invoice.");
  }
  const byoPlanStdout = run(
    "node",
    [
      "scripts/microservices.js",
      "deploy",
      "preview",
      "--plan",
      "--target",
      "cloudflare",
      "--cloudflare-auth",
      "api-token",
      "--cloudflare-account-id",
      "acct_smoke",
      "--cloudflare-zone-id",
      "zone_smoke",
      "--cloudflare-preview-base-domain",
      "preview.example.com",
      "--cloudflare-api-token",
      "secret_smoke_token",
      "--json",
    ],
    { cwd: svelteRoot }
  ).stdout;
  if (byoPlanStdout.includes("secret_smoke_token")) {
    throw new Error("BYO Cloudflare deploy plan must not echo raw Cloudflare API tokens.");
  }
  const byoPlan = JSON.parse(byoPlanStdout);
  assert.strictEqual(byoPlan.ok, true);
  assert.strictEqual(byoPlan.data.target.provider, "cloudflare");
  assert.strictEqual(byoPlan.data.target.auth, "api_token");
  assert.strictEqual(byoPlan.data.target.accountId, "acct_smoke");
  assert.strictEqual(byoPlan.data.target.zoneId, "zone_smoke");
  assert.strictEqual(byoPlan.data.target.previewBaseDomain, "preview.example.com");
  assert.strictEqual(byoPlan.data.target.tokenStored, false);
  const ciGuard = spawnSync(
    "node",
    [
      "scripts/microservices.js",
      "deploy",
      "provision",
      "dep_smoke",
      "--confirm",
      "provision",
      "--ci",
      "--json",
    ],
    {
      cwd: svelteRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        MICROSERVICES_API_KEY: "",
        MICROSERVICES_TOKEN: "",
        MICROSERVICES_CONFIG_PATH: join(tempRoot, "empty-cli-config.json"),
      },
    }
  );
  if ((ciGuard.status ?? 1) === 0) {
    throw new Error("CI deploy actions should require MICROSERVICES_API_KEY before calling the API.");
  }
  const ciGuardPayload = JSON.parse(ciGuard.stdout);
  assert.strictEqual(ciGuardPayload.ok, false);
  assert.strictEqual(ciGuardPayload.error.code, "CI_API_KEY_REQUIRED");
  const invalidTarget = spawnSync(
    "node",
    [
      "scripts/microservices.js",
      "deploy",
      "preview",
      "--plan",
      "--target",
      "cloudflrae",
      "--json",
    ],
    {
      cwd: svelteRoot,
      encoding: "utf8",
    }
  );
  if ((invalidTarget.status ?? 1) === 0) {
    throw new Error("Invalid deploy targets should fail instead of falling back to managed deploys.");
  }
  const invalidTargetPayload = JSON.parse(invalidTarget.stdout);
  assert.strictEqual(invalidTargetPayload.ok, false);
  assert.strictEqual(invalidTargetPayload.error.code, "DEPLOY_TARGET_INVALID");
  const missingFlagValue = spawnSync(
    "node",
    [
      "scripts/microservices.js",
      "deploy",
      "preview",
      "--plan",
      "--target",
      "--json",
    ],
    {
      cwd: svelteRoot,
      encoding: "utf8",
    }
  );
  if ((missingFlagValue.status ?? 1) === 0) {
    throw new Error("Flags requiring values should fail when followed by another option.");
  }
  const missingFlagValuePayload = JSON.parse(missingFlagValue.stdout);
  assert.strictEqual(missingFlagValuePayload.ok, false);
  assert.strictEqual(missingFlagValuePayload.error.code, "CLI_FLAG_VALUE_REQUIRED");
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

  // ─── Network-gated C3 framework smoke ────────────────────────────────────
  // Pass --network to scaffold each framework via the live CLI and assert that
  // the hook artifacts (config, shim, README, package.json script) land correctly.
  // Without --network this section is skipped so the test stays green offline.
  const NETWORK = process.argv.includes("--network");
  const DIST = resolve(dirname(fileURLToPath(import.meta.url)), "..", "dist", "index.js");

  if (!NETWORK) {
    process.stdout.write("framework smoke: skipped (pass --network to run)\n");
  } else {
    const frameworks = loadFrameworks();
    for (const row of frameworks) {
      const dir = mkdtempSync(join(tmpdir(), `smoke-${row.id}-`));
      process.stdout.write(`framework smoke: scaffolding ${row.id} in ${dir} …\n`);

      const result = spawnSync(
        "node",
        [DIST, "app", "--template", row.id, "--package-manager", "npm"],
        { cwd: dir, stdio: "inherit" }
      );

      // Tolerate EPERM sandbox quirk: only throw when status is absent
      if (result.error && typeof result.status !== "number") throw result.error;

      assert.strictEqual(
        result.status,
        0,
        `C3 scaffold for ${row.id} exited with status ${result.status}`
      );

      const appDir = join(dir, "app");
      assert.ok(
        existsSync(join(appDir, "microservices.config.json")),
        `${row.id}: microservices.config.json missing`
      );
      assert.ok(
        existsSync(join(appDir, "scripts", "microservices.js")),
        `${row.id}: scripts/microservices.js (vendored shim) missing`
      );

      const readmeText = readFileSync(join(appDir, "README.microservices.md"), "utf8");
      assert.ok(
        readmeText.includes("microservices") && readmeText.includes("add"),
        `${row.id}: README.microservices.md missing expected content`
      );

      const appPkg = JSON.parse(readFileSync(join(appDir, "package.json"), "utf8"));
      assert.strictEqual(
        appPkg.scripts?.microservices,
        "node scripts/microservices.js",
        `${row.id}: package.json scripts.microservices wrong`
      );

      // Validate the vendored shim actually runs (network-agnostic command)
      const list = spawnSync(
        "node",
        ["scripts/microservices.js", "modules", "list"],
        { cwd: appDir, stdio: "pipe", encoding: "utf8" }
      );
      if (list.error && typeof list.status !== "number") throw list.error;
      assert.strictEqual(
        list.status,
        0,
        `${row.id}: shim 'modules list' exited ${list.status}\nstdout:${list.stdout}\nstderr:${list.stderr}`
      );

      process.stdout.write(`framework smoke ok: ${row.id}\n`);
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  process.stdout.write("create-microservices-app smoke test passed\n");
} catch (error) {
  process.stderr.write(`create-microservices-app smoke test failed\nTemp root: ${tempRoot}\n${error.message}\n`);
  process.exitCode = 1;
}
