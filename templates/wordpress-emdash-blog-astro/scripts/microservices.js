#!/usr/bin/env node
import { closeSync, createReadStream, existsSync, openSync, readFileSync, readSync } from "node:fs";
import { copyFile, mkdir, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { basename, dirname, extname, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { inflateSync } from "node:zlib";

const cli = parseCli(process.argv.slice(2));
const json = Boolean(cli.flags.json);
const [resource, subresource, ...positionals] = cli.positionals;

const MIGRATION_DIR = ".migration";
const MIGRATION_INPUT_DIR = `${MIGRATION_DIR}/input`;
const DEFAULT_PROBE_REPORT = "migration-reports/wp-source-probe.json";
const MIGRATION_CONFIG_PATH = `${MIGRATION_DIR}/migration-config.json`;
const THEME_MANIFEST_PATH = `${MIGRATION_DIR}/theme-manifest.json`;
const THEME_ANALYSIS_PATH = `${MIGRATION_DIR}/theme-analysis.json`;
const THEME_CONVERSION_PATH = `${MIGRATION_DIR}/theme-conversion.json`;
const CAPTURE_PLAN_PATH = `${MIGRATION_DIR}/capture-plan.json`;
const MIGRATION_PLAN_JSON_PATH = `${MIGRATION_DIR}/migration-plan.json`;
const MIGRATION_PLAN_MD_PATH = `${MIGRATION_DIR}/migration-plan.md`;
const CAPTURE_RESULT_PATH = "migration-reports/capture-result.json";
const THEME_PARITY_REPORT_PATH = "migration-reports/theme-parity.json";
const DEFAULT_CAPTURE_WIDTHS = [390, 768, 1440];

function readJson(path, fallback = {}) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

function manifestId() {
  return readJson("microservices.template.json", { id: "wordpress-emdash-blog-astro" }).id;
}

function checkResponse() {
  const required = [
    "microservices.template.json",
    "microservices.config.json",
    "microservices.lock.json",
    "package.json",
    ".gitignore",
    "astro.config.mjs",
    "wrangler.jsonc",
    "src/live.config.ts",
    "src/pages/index.astro",
    "src/pages/blog/[slug].astro",
    "src/pages/rss.xml.ts",
    "docs/llms.txt",
    "docs/api-boundary.md",
    "docs/cli-workflow.md",
    "scripts/wp-probe.mjs",
  ];

  const checks = required.map((file) => ({
    id: file,
    status: existsSync(file) ? "pass" : "fail",
    message: existsSync(file) ? `${file} present.` : `${file} missing.`,
  }));

  const config = readJson("wrangler.jsonc", null);
  if (config) {
    checks.push({
      id: "cloudflare-bindings",
      status: config.d1_databases?.some((item) => item.binding === "DB") && config.r2_buckets?.some((item) => item.binding === "MEDIA") ? "pass" : "fail",
      message: "D1 DB and R2 MEDIA bindings are declared.",
    });
  }

  const status = checks.every((check) => check.status === "pass") ? "pass" : "fail";
  return { ok: status === "pass", data: { template: manifestId(), status, checks } };
}

function emit(object, human) {
  if (json) process.stdout.write(`${JSON.stringify(object, null, 2)}\n`);
  else process.stdout.write(human(object));
}

if (resource === "check") {
  const result = checkResponse();
  emit(result, (value) => `${value.data.status}\n${value.data.checks.map((check) => `- ${check.id}: ${check.status} - ${check.message}`).join("\n")}\n`);
  process.exitCode = result.ok ? 0 : 1;
} else if (resource === "modules") {
  const result = {
    ok: true,
    data: {
      modules: [],
      note: "Content migration template. EmDash owns CMS/admin/import; no microservices.sh runtime modules are required for v0.",
    },
  };
  emit(result, (value) => `${value.data.note}\n`);
} else if (resource === "wp") {
  await handleWordPress(subresource, positionals, cli.flags);
} else {
  const help = formatHelp();
  emit({ ok: true, data: { help } }, (value) => value.data.help);
}

async function handleWordPress(command, values, flags) {
  if (!command || command === "help") {
    emit({ ok: true, data: { help: formatWordPressHelp() } }, (value) => value.data.help);
    return;
  }

  if (command === "add-theme") {
    const result = await addTheme(values[0] || flags.theme || flags["theme-zip"], flags);
    emit(result, formatThemeResult);
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  if (command === "probe") {
    process.exitCode = await runProbe(values, flags);
    return;
  }

  if (command === "analyze-theme") {
    const result = await analyzeThemeCommand(values[0] || flags.theme || flags["theme-zip"], flags);
    emit(result, formatThemeAnalysisResult);
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  if (command === "convert-theme") {
    const result = await createThemeConversionHandoff(flags);
    emit(result, formatThemeConversionResult);
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  if (command === "capture") {
    const result = await createCapturePlan(flags);
    emit(result, formatCapturePlanResult);
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  if (command === "diff-theme") {
    const result = await generateThemeParityReport(flags);
    emit(result, formatThemeDiffResult);
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  if (command === "validate-theme") {
    if (flags.generate || flags["from-captures"]) {
      const generated = await generateThemeParityReport(flags);
      emit(generated, formatThemeValidationResult);
      process.exitCode = generated.data?.launchReady ? 0 : 1;
      return;
    }

    const result = validateThemeParity(flags);
    emit(result, formatThemeValidationResult);
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  if (command === "migrate" || command === "plan") {
    const result = await createMigrationPlan(command, values, flags);
    emit(result, formatPlanResult);
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  if (command === "status") {
    const result = migrationStatus();
    emit(result, formatStatusResult);
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  emit({ ok: false, error: `Unknown WordPress command: ${command}` }, (value) => `${value.error}\n\n${formatWordPressHelp()}`);
  process.exitCode = 1;
}

async function runProbe(values, flags) {
  const existingConfig = readJson(MIGRATION_CONFIG_PATH, {});
  const source = flags.source || values[0] || existingConfig.sourceUrl;
  const username = flags.username || process.env.WP_USERNAME;
  let appPassword = process.env.WP_APP_PASSWORD || "";

  if (flags["password-stdin"]) {
    appPassword = (await readAllStdin()).trim();
  } else if (flags["password-prompt"]) {
    try {
      appPassword = await promptHidden("WordPress Application Password: ");
    } catch (error) {
      process.stderr.write(`Error: ${error.message}\n`);
      return 1;
    }
  }

  const args = ["scripts/wp-probe.mjs"];
  if (source) args.push("--source", source);
  if (username) args.push("--username", username);
  if (flags.out) args.push("--out", flags.out);
  if (flags.report) args.push("--out", flags.report);
  if (flags.json) args.push("--json");
  return await runInherited(process.execPath, args, {
    ...process.env,
    WP_APP_PASSWORD: appPassword,
  });
}

async function addTheme(inputPath, flags) {
  if (!inputPath) {
    return fail("Pass a theme ZIP path, for example: npm run microservices -- wp add-theme ./theme.zip");
  }

  const sourcePath = resolve(inputPath);
  if (!existsSync(sourcePath)) {
    return fail(`Theme ZIP not found: ${inputPath}`);
  }

  const sourceStat = await stat(sourcePath);
  if (!sourceStat.isFile()) {
    return fail(`Theme ZIP path is not a file: ${inputPath}`);
  }

  if (extname(sourcePath).toLowerCase() !== ".zip") {
    return fail("Theme source must be a .zip file.");
  }

  if (sourceStat.size === 0) {
    return fail("Theme ZIP is empty.");
  }

  if (!hasZipSignature(sourcePath)) {
    return fail("Theme source does not look like a valid ZIP archive.");
  }

  const analysis = await analyzeThemeArchive(sourcePath);
  if (!analysis.ok && !flags["allow-invalid"]) {
    return fail(`${analysis.error} Use --allow-invalid only for manual forensic review, not for standard migration.`);
  }

  await mkdir(MIGRATION_INPUT_DIR, { recursive: true });

  const kind = flags.child ? "childTheme" : "activeTheme";
  const targetPath = resolve(MIGRATION_INPUT_DIR, `${kind}-${basename(sourcePath)}`);
  if (targetPath !== sourcePath) {
    await copyFile(sourcePath, targetPath);
  }

  const manifest = readJson(THEME_MANIFEST_PATH, {
    version: 1,
    updatedAt: null,
    activeTheme: null,
    childTheme: null,
  });

  const entry = {
    kind,
    originalPath: sourcePath,
    storedPath: relativePath(targetPath),
    fileName: basename(sourcePath),
    sizeBytes: sourceStat.size,
    sha256: await sha256File(sourcePath),
    addedAt: new Date().toISOString(),
    analysis: analysis.data ? summarizeThemeAnalysis(analysis.data) : null,
  };

  manifest.version = 1;
  manifest.updatedAt = entry.addedAt;
  manifest[kind] = entry;

  await writeJson(THEME_MANIFEST_PATH, manifest);
  if (analysis.data) await writeThemeAnalysis(kind, analysis.data);

  return {
    ok: true,
    data: {
      manifestPath: THEME_MANIFEST_PATH,
      analysisPath: analysis.data ? THEME_ANALYSIS_PATH : null,
      theme: entry,
      analysis: analysis.data,
      next: [
        "Run npm run microservices -- wp analyze-theme to refresh the theme inventory after replacing the ZIP.",
        "Run npm run microservices -- wp plan after the probe report is ready.",
        "Run npm run microservices -- wp migrate --source <url> --theme <theme.zip> to create a full migration plan in one command.",
      ],
    },
  };
}

async function analyzeThemeCommand(inputPath, flags) {
  const kind = flags.child ? "childTheme" : "activeTheme";
  const themeManifest = readJson(THEME_MANIFEST_PATH, {});
  const resolvedPath = inputPath || themeManifest[kind]?.storedPath;

  if (!resolvedPath) {
    return fail(`No ${kind} ZIP found. Run npm run microservices -- wp add-theme ./theme.zip first.`);
  }

  const analysis = await analyzeThemeArchive(resolvedPath);
  if (!analysis.ok) return analysis;

  await writeThemeAnalysis(kind, analysis.data);

  if (themeManifest[kind]) {
    themeManifest[kind].analysis = summarizeThemeAnalysis(analysis.data);
    themeManifest.updatedAt = new Date().toISOString();
    await writeJson(THEME_MANIFEST_PATH, themeManifest);
  }

  return {
    ok: true,
    data: {
      analysisPath: THEME_ANALYSIS_PATH,
      kind,
      analysis: analysis.data,
      next: [
        "Run npm run microservices -- wp plan.",
        "Run npm run microservices -- wp convert-theme --pages /,/blog,/sample-post.",
      ],
    },
  };
}

async function createThemeConversionHandoff(flags) {
  const config = readJson(MIGRATION_CONFIG_PATH, null);
  const themeAnalysis = readJson(THEME_ANALYSIS_PATH, null);
  const activeThemeAnalysis = themeAnalysis?.themes?.activeTheme;
  const sourceUrl = normalizeBase(flags.source || config?.sourceUrl);

  if (config?.mode === "content-only") {
    return fail("Content-only mode does not convert the WordPress theme. Re-run wp migrate without --content-only for design-preserved migration.");
  }

  if (!activeThemeAnalysis) {
    return fail("Theme analysis is missing. Run npm run microservices -- wp analyze-theme first.");
  }

  const pages = parseCsv(flags.pages || "/,/blog,/sample-post");
  const mode = flags.mode || "source-inspired";
  const generatedAt = new Date().toISOString();
  const report = {
    version: 1,
    status: "ready-for-agent",
    generatedAt,
    mode,
    sourceUrl,
    skill: "skills/wordpress-theme-to-astro",
    themeAnalysisPath: THEME_ANALYSIS_PATH,
    themeSummary: summarizeThemeAnalysis(activeThemeAnalysis),
    pages,
    requiredOutputs: [
      "src/theme/tokens.css",
      "src/theme/Header.astro",
      "src/theme/Footer.astro",
      "src/theme/PostLayout.astro or src/theme/PageLayout.astro",
      "updated src/layouts/Base.astro and relevant routes",
      "docs/layout-rebuild.md",
      THEME_PARITY_REPORT_PATH,
    ],
    prompt: [
      "Use the wordpress-theme-to-astro skill.",
      `Source URL: ${sourceUrl || "<source-url>"}`,
      `Mode: ${mode}`,
      `Theme analysis: ${THEME_ANALYSIS_PATH}`,
      `Reference pages: ${pages.join(", ")}`,
      "Rebuild the WordPress theme as Astro components using EmDash content helpers.",
      "Do not port PHP runtime code. Translate visible layout, tokens, assets, navigation, and templates.",
      "Record parity score and gaps in migration-reports/theme-parity.json and docs/layout-rebuild.md.",
    ].join("\n"),
    next: [
      "Run an AI coding agent with the generated prompt from .migration/theme-conversion.json.",
      "After conversion, run npm run microservices -- wp capture --rebuilt http://localhost:4321 --run.",
      "Then run npm run microservices -- wp diff-theme.",
      "Then run npm run microservices -- wp validate-theme.",
    ],
  };

  await writeJson(THEME_CONVERSION_PATH, report);
  return { ok: true, data: report };
}

async function createCapturePlan(flags) {
  const config = readJson(MIGRATION_CONFIG_PATH, null);
  const sourceUrl = normalizeBase(flags.source || config?.sourceUrl);
  const rebuiltUrl = normalizeBase(flags.rebuilt || flags.local || "http://localhost:4321");
  const widths = parseWidths(flags.widths || DEFAULT_CAPTURE_WIDTHS.join(","));
  const pages = parseCsv(flags.pages || "/,/blog,/sample-post");

  if (!sourceUrl) return fail("Source URL is missing. Pass --source <wordpress-url> or run wp migrate first.");
  if (!rebuiltUrl) return fail("Rebuilt URL is invalid. Pass --rebuilt http://localhost:4321.");

  const plan = {
    version: 1,
    status: "ready-for-capture",
    generatedAt: new Date().toISOString(),
    sourceUrl,
    rebuiltUrl,
    widths,
    pages,
    output: {
      source: "migration-reports/screenshots/source",
      rebuilt: "migration-reports/screenshots/rebuilt",
    },
    expectedFiles: expectedScreenshotFiles({ pages, widths }),
    fallbackPolicy: [
      "Retry source and rebuilt captures independently.",
      "If browser capture fails, mark screenshots.status as blocked in migration-reports/theme-parity.json.",
      "Do not mark the theme launch-ready without either screenshots or an explicit blocked-capture review note.",
    ],
  };

  await mkdir(plan.output.source, { recursive: true });
  await mkdir(plan.output.rebuilt, { recursive: true });
  await writeJson(CAPTURE_PLAN_PATH, plan);

  if (flags.run) {
    const capture = await runCapturePlan(plan, flags);
    return {
      ok: capture.ok,
      data: {
        ...plan,
        capture,
      },
    };
  }

  return { ok: true, data: plan };
}

async function runCapturePlan(plan, flags) {
  const timeoutMs = Number(flags.timeout || 30000);
  const captures = [];
  const browser = await resolveScreenshotBrowser(flags);

  for (const page of plan.pages) {
    for (const width of plan.widths) {
      for (const target of ["source", "rebuilt"]) {
        const baseUrl = target === "source" ? plan.sourceUrl : plan.rebuiltUrl;
        const url = composeUrl(baseUrl, page);
        const path = screenshotPath({ target, page, width });
        await mkdir(dirname(resolve(path)), { recursive: true });
        const startedAt = new Date().toISOString();

        try {
          const result = await browser.capture({ url, path, width, timeoutMs });
          captures.push({
            target,
            page,
            width,
            url,
            path,
            startedAt,
            completedAt: new Date().toISOString(),
            status: "captured",
            browser: result.browser,
            fullPage: result.fullPage,
          });
        } catch (error) {
          captures.push({
            target,
            page,
            width,
            url,
            path,
            startedAt,
            completedAt: new Date().toISOString(),
            status: "failed",
            browser: browser.name,
            error: error.message,
          });
        }
      }
    }
  }

  if (browser.close) await browser.close();

  const failed = captures.filter((item) => item.status !== "captured");
  const result = {
    version: 1,
    generatedAt: new Date().toISOString(),
    status: captureRunStatus(captures, failed),
    browser: browser.name,
    planPath: CAPTURE_PLAN_PATH,
    captures,
    failed,
    next: [
      "Run npm run microservices -- wp diff-theme.",
      "Review migration-reports/theme-parity.json and fill manual score sections before launch.",
      "Run npm run microservices -- wp validate-theme.",
    ],
  };

  await writeJson(CAPTURE_RESULT_PATH, result);
  return { ok: failed.length === 0, data: result };
}

function captureRunStatus(captures, failed) {
  if (failed.length === 0) return "captured";
  if (captures.some((item) => item.status === "captured")) return "partial";
  return "blocked";
}

async function resolveScreenshotBrowser(flags) {
  if (flags.browser === "chrome") return resolveChromeBrowser(flags);
  if (flags.browser === "playwright") return await resolvePlaywrightBrowser(flags);

  try {
    return await resolvePlaywrightBrowser(flags);
  } catch {
    return resolveChromeBrowser(flags);
  }
}

async function resolvePlaywrightBrowser(flags) {
  const playwright = await import("playwright");
  const browser = await playwright.chromium.launch({
    headless: true,
    executablePath: flags["browser-path"] || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  });

  return {
    name: "playwright",
    async capture({ url, path, width, timeoutMs }) {
      const page = await browser.newPage({
        viewport: { width, height: 900 },
        deviceScaleFactor: 1,
      });
      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: timeoutMs });
        await page.screenshot({ path, fullPage: true, animations: "disabled" });
        return { browser: "playwright", fullPage: true };
      } finally {
        await page.close();
      }
    },
    async close() {
      await browser.close();
    },
  };
}

function resolveChromeBrowser(flags) {
  const executable = flags["browser-path"] || process.env.CHROME_BIN || "google-chrome";
  return {
    name: "chrome-cli",
    async capture({ url, path, width, timeoutMs }) {
      const args = [
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--hide-scrollbars",
        "--run-all-compositor-stages-before-draw",
        `--virtual-time-budget=${Math.min(timeoutMs, 10000)}`,
        `--window-size=${width},1200`,
        `--screenshot=${resolve(path)}`,
        url,
      ];
      const result = await runBuffered(executable, args, { maxBytes: 512 * 1024 });
      if (result.error) throw new Error(result.error);
      if (result.code !== 0) throw new Error(firstUsefulLine(result.stderr || result.stdout));
      return { browser: "chrome-cli", fullPage: false };
    },
  };
}

function validateThemeParity(flags) {
  const reportPath = flags.report || THEME_PARITY_REPORT_PATH;
  if (!existsSync(reportPath)) {
    return fail(`Theme parity report not found: ${reportPath}. Run the theme conversion agent and write ${THEME_PARITY_REPORT_PATH}.`);
  }

  const report = readJson(reportPath, null);
  if (!report) return fail(`Theme parity report is not valid JSON: ${reportPath}`);

  const score = Number(report.score ?? report.totalScore ?? report.summary?.score ?? 0);
  const criticalFailures = normalizeCriticalFailures(report);
  const launchReady = score >= 85 && criticalFailures.length === 0;
  const result = {
    ok: launchReady,
    data: {
      reportPath,
      score,
      threshold: 85,
      launchReady,
      criticalFailures,
      screenshotStatus: report.screenshots?.status || report.capture?.status || "unknown",
      next: launchReady
        ? ["Run npm run build.", "Deploy a Cloudflare preview.", "Run SEO/cutover checks before DNS."]
        : ["Fix reported parity gaps.", "Refresh screenshots and migration-reports/theme-parity.json.", "Re-run npm run microservices -- wp validate-theme."],
    },
  };

  return result;
}

async function generateThemeParityReport(flags) {
  const planPath = flags.plan || CAPTURE_PLAN_PATH;
  const capturePath = flags.capture || CAPTURE_RESULT_PATH;
  const reportPath = flags.out || flags.report || THEME_PARITY_REPORT_PATH;
  const plan = readJson(planPath, null);
  const capture = readJson(capturePath, null);

  if (!plan) return fail(`Capture plan not found: ${planPath}. Run npm run microservices -- wp capture first.`);

  const existingReport = existsSync(reportPath) ? readJson(reportPath, {}) : {};
  const manualMetrics = readJson(flags.manual || "", null)?.manualMetrics || existingReport.manualMetrics || {};
  const pairs = [];

  for (const page of plan.pages || []) {
    for (const width of plan.widths || []) {
      const sourcePath = screenshotPath({ target: "source", page, width });
      const rebuiltPath = screenshotPath({ target: "rebuilt", page, width });
      pairs.push(compareScreenshotPair({ page, width, sourcePath, rebuiltPath }));
    }
  }

  const expectedPairs = pairs.length;
  const comparedPairs = pairs.filter((pair) => pair.status === "compared");
  const missingPairs = pairs.filter((pair) => pair.status !== "compared");
  const avgVisual = average(comparedPairs.map((pair) => pair.visualScore));
  const avgGeometry = average(comparedPairs.map((pair) => pair.dimensionSimilarity));
  const widths = [...new Set((plan.widths || []).map(Number))];
  const completeWidths = widths.filter((width) => pairs.filter((pair) => pair.width === width).every((pair) => pair.status === "compared"));
  const criticalFailures = [];

  if (capture?.status === "blocked") criticalFailures.push("Screenshot capture was blocked.");
  if (missingPairs.length) criticalFailures.push(`${missingPairs.length} screenshot pair(s) missing or unreadable.`);

  const metrics = buildParityMetrics({
    avgVisual,
    avgGeometry,
    expectedPairs,
    comparedPairCount: comparedPairs.length,
    widths,
    completeWidthCount: completeWidths.length,
    manualMetrics,
  });
  const score = Math.round(Object.values(metrics).reduce((sum, item) => sum + item.points, 0));
  const launchReady = score >= 85 && criticalFailures.length === 0;
  const screenshotStatus = screenshotDiffStatus(capture, missingPairs);
  const report = {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: "automated-screenshot-diff",
    score,
    threshold: 85,
    launchReady,
    criticalFailures,
    screenshotStatus,
    manualMetrics,
    screenshots: {
      status: screenshotStatus,
      planPath,
      captureResultPath: existsSync(capturePath) ? capturePath : null,
      expectedPairs,
      comparedPairs: comparedPairs.length,
      missingPairs: missingPairs.length,
      pairs,
    },
    metrics,
    manualReview: [
      "Automated score covers screenshot similarity, geometry, route capture, and responsive capture completeness.",
      "Fill manualMetrics.designTokens, manualMetrics.interactionParity, manualMetrics.accessibilityPerformance, and manualMetrics.unsupportedSurfaceReporting before launch.",
      "Review docs/layout-rebuild.md for intentional differences and unsupported WordPress/plugin surfaces.",
    ],
    next: launchReady
      ? ["Run npm run build.", "Deploy a Cloudflare preview.", "Run SEO/cutover checks before DNS."]
      : ["Review screenshot diff pairs.", "Fill manualMetrics or fix visual gaps in migration-reports/theme-parity.json.", "Re-run npm run microservices -- wp validate-theme."],
  };

  await writeJson(reportPath, report);
  return { ok: true, data: { ...report, reportPath } };
}

function buildParityMetrics({ avgVisual, avgGeometry, expectedPairs, comparedPairCount, widths, completeWidthCount, manualMetrics }) {
  const contentRouteRatio = expectedPairs > 0 ? comparedPairCount / expectedPairs : 0;
  const responsiveRatio = widths.length > 0 ? completeWidthCount / widths.length : 0;

  return {
    visualParity: metric("visualParity", 30, avgVisual / 100),
    layoutGeometry: metric("layoutGeometry", 15, avgGeometry / 100),
    contentRouteParity: metric("contentRouteParity", 15, contentRouteRatio),
    designTokens: manualMetric("designTokens", 10, manualMetrics),
    responsiveBehavior: metric("responsiveBehavior", 10, responsiveRatio),
    interactionParity: manualMetric("interactionParity", 5, manualMetrics),
    accessibilityPerformance: manualMetric("accessibilityPerformance", 10, manualMetrics),
    unsupportedSurfaceReporting: manualMetric("unsupportedSurfaceReporting", 5, manualMetrics),
  };
}

function screenshotDiffStatus(capture, missingPairs) {
  if (capture?.status) return capture.status;
  if (missingPairs.length > 0) return "partial";
  return "captured";
}

function compareScreenshotPair({ page, width, sourcePath, rebuiltPath }) {
  if (!existsSync(sourcePath) || !existsSync(rebuiltPath)) {
    return {
      page,
      width,
      sourcePath,
      rebuiltPath,
      status: "missing",
      visualScore: 0,
      dimensionSimilarity: 0,
      score: 0,
    };
  }

  try {
    const source = readPng(sourcePath);
    const rebuilt = readPng(rebuiltPath);
    const sampleWidth = Math.min(180, Math.max(1, Math.min(source.width, rebuilt.width)));
    const sampleHeight = Math.min(240, Math.max(1, Math.min(source.height, rebuilt.height)));
    let diff = 0;
    let samples = 0;

    for (let y = 0; y < sampleHeight; y += 1) {
      const ny = normalizedSamplePosition(y, sampleHeight);
      for (let x = 0; x < sampleWidth; x += 1) {
        const nx = normalizedSamplePosition(x, sampleWidth);
        const left = samplePixel(source, nx, ny);
        const right = samplePixel(rebuilt, nx, ny);
        diff += (Math.abs(left[0] - right[0]) + Math.abs(left[1] - right[1]) + Math.abs(left[2] - right[2])) / (3 * 255);
        samples += 1;
      }
    }

    const avgDiff = samples ? diff / samples : 1;
    const visualScore = Math.max(0, Math.round((1 - avgDiff) * 100));
    const widthSimilarity = ratioSimilarity(source.width, rebuilt.width);
    const heightSimilarity = ratioSimilarity(source.height, rebuilt.height);
    const dimensionSimilarity = Math.round((widthSimilarity * 0.45 + heightSimilarity * 0.55) * 100);
    const score = Math.round(visualScore * 0.75 + dimensionSimilarity * 0.25);

    return {
      page,
      width,
      sourcePath,
      rebuiltPath,
      status: "compared",
      sourceDimensions: { width: source.width, height: source.height },
      rebuiltDimensions: { width: rebuilt.width, height: rebuilt.height },
      visualScore,
      dimensionSimilarity,
      score,
    };
  } catch (error) {
    return {
      page,
      width,
      sourcePath,
      rebuiltPath,
      status: "error",
      error: error.message,
      visualScore: 0,
      dimensionSimilarity: 0,
      score: 0,
    };
  }
}

function normalizedSamplePosition(index, length) {
  if (length <= 1) return 0;
  return index / (length - 1);
}

function readPng(path) {
  const bytes = readFileSync(path);
  const signature = "89504e470d0a1a0a";
  if (bytes.subarray(0, 8).toString("hex") !== signature) throw new Error("Not a PNG file.");

  let offset = 8;
  let ihdr = null;
  let palette = null;
  let transparency = null;
  const idats = [];

  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === "IHDR") {
      ihdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        interlace: data[12],
      };
    } else if (type === "PLTE") {
      palette = data;
    } else if (type === "tRNS") {
      transparency = data;
    } else if (type === "IDAT") {
      idats.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  if (!ihdr) throw new Error("PNG IHDR missing.");
  if (ihdr.bitDepth !== 8) throw new Error(`Unsupported PNG bit depth ${ihdr.bitDepth}.`);
  if (ihdr.interlace !== 0) throw new Error("Interlaced PNG is not supported.");

  const channels = pngChannels(ihdr.colorType);
  const bpp = channels;
  const stride = ihdr.width * channels;
  const raw = inflateSync(Buffer.concat(idats));
  const rgba = Buffer.alloc(ihdr.width * ihdr.height * 4);
  let rawOffset = 0;
  let prev = Buffer.alloc(stride);

  for (let y = 0; y < ihdr.height; y += 1) {
    const filter = raw[rawOffset];
    rawOffset += 1;
    const current = Buffer.from(raw.subarray(rawOffset, rawOffset + stride));
    rawOffset += stride;
    unfilterScanline(current, prev, filter, bpp);

    for (let x = 0; x < ihdr.width; x += 1) {
      const sourceIndex = x * channels;
      const targetIndex = (y * ihdr.width + x) * 4;
      writeRgba({ rgba, targetIndex, row: current, sourceIndex, colorType: ihdr.colorType, palette, transparency });
    }

    prev = current;
  }

  return {
    width: ihdr.width,
    height: ihdr.height,
    rgba,
  };
}

function pngChannels(colorType) {
  if (colorType === 0) return 1;
  if (colorType === 2) return 3;
  if (colorType === 3) return 1;
  if (colorType === 4) return 2;
  if (colorType === 6) return 4;
  throw new Error(`Unsupported PNG color type ${colorType}.`);
}

function unfilterScanline(row, prev, filter, bpp) {
  for (let index = 0; index < row.length; index += 1) {
    const left = index >= bpp ? row[index - bpp] : 0;
    const up = prev[index] || 0;
    const upLeft = index >= bpp ? prev[index - bpp] || 0 : 0;
    let value = 0;

    if (filter === 0) value = row[index];
    else if (filter === 1) value = row[index] + left;
    else if (filter === 2) value = row[index] + up;
    else if (filter === 3) value = row[index] + Math.floor((left + up) / 2);
    else if (filter === 4) value = row[index] + paeth(left, up, upLeft);
    else throw new Error(`Unsupported PNG filter ${filter}.`);

    row[index] = value & 0xff;
  }
}

function writeRgba({ rgba, targetIndex, row, sourceIndex, colorType, palette, transparency }) {
  if (colorType === 0) {
    const gray = row[sourceIndex];
    rgba[targetIndex] = gray;
    rgba[targetIndex + 1] = gray;
    rgba[targetIndex + 2] = gray;
    rgba[targetIndex + 3] = 255;
  } else if (colorType === 2) {
    rgba[targetIndex] = row[sourceIndex];
    rgba[targetIndex + 1] = row[sourceIndex + 1];
    rgba[targetIndex + 2] = row[sourceIndex + 2];
    rgba[targetIndex + 3] = 255;
  } else if (colorType === 3) {
    if (!palette) throw new Error("Palette PNG missing PLTE chunk.");
    const paletteIndex = row[sourceIndex] * 3;
    rgba[targetIndex] = palette[paletteIndex] || 0;
    rgba[targetIndex + 1] = palette[paletteIndex + 1] || 0;
    rgba[targetIndex + 2] = palette[paletteIndex + 2] || 0;
    rgba[targetIndex + 3] = transparency?.[row[sourceIndex]] ?? 255;
  } else if (colorType === 4) {
    const gray = row[sourceIndex];
    rgba[targetIndex] = gray;
    rgba[targetIndex + 1] = gray;
    rgba[targetIndex + 2] = gray;
    rgba[targetIndex + 3] = row[sourceIndex + 1];
  } else if (colorType === 6) {
    rgba[targetIndex] = row[sourceIndex];
    rgba[targetIndex + 1] = row[sourceIndex + 1];
    rgba[targetIndex + 2] = row[sourceIndex + 2];
    rgba[targetIndex + 3] = row[sourceIndex + 3];
  }
}

function paeth(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) return left;
  if (upDistance <= upLeftDistance) return up;
  return upLeft;
}

function samplePixel(image, nx, ny) {
  const x = Math.max(0, Math.min(image.width - 1, Math.round(nx * (image.width - 1))));
  const y = Math.max(0, Math.min(image.height - 1, Math.round(ny * (image.height - 1))));
  const index = (y * image.width + x) * 4;
  return [
    image.rgba[index],
    image.rgba[index + 1],
    image.rgba[index + 2],
    image.rgba[index + 3],
  ];
}

function ratioSimilarity(left, right) {
  if (!left || !right) return 0;
  return Math.max(0, Math.min(left, right) / Math.max(left, right));
}

function metric(id, max, ratio) {
  const normalized = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0;
  return {
    id,
    points: Math.round(max * normalized * 10) / 10,
    max,
    status: metricStatus(normalized),
    automated: true,
  };
}

function metricStatus(normalized) {
  if (normalized >= 0.85) return "pass";
  if (normalized >= 0.6) return "warn";
  return "fail";
}

function manualMetric(id, max, manualMetrics) {
  const raw = manualMetrics?.[id];
  const points = Number(typeof raw === "object" ? raw.points : raw);
  const normalized = Number.isFinite(points) ? Math.max(0, Math.min(max, points)) : 0;
  return {
    id,
    points: normalized,
    max,
    status: manualMetricStatus(points, normalized, max),
    automated: false,
  };
}

function manualMetricStatus(points, normalized, max) {
  if (!Number.isFinite(points)) return "manual-required";
  if (normalized / max >= 0.85) return "pass";
  return "warn";
}

async function createMigrationPlan(command, values, flags) {
  const mode = resolveMode(flags);
  const themeInput = flags.theme || flags["theme-zip"] || values[0];
  const childThemeInput = flags["child-theme"];

  if (themeInput) {
    const added = await addTheme(themeInput, { child: false });
    if (!added.ok) return added;
  }

  if (childThemeInput) {
    const added = await addTheme(childThemeInput, { child: true });
    if (!added.ok) return added;
  }

  const existingConfig = readJson(MIGRATION_CONFIG_PATH, {});
  const reportPath = flags.report || existingConfig.reportPath || DEFAULT_PROBE_REPORT;
  const report = existsSync(reportPath) ? readJson(reportPath, null) : null;
  const themeManifest = readJson(THEME_MANIFEST_PATH, {
    activeTheme: null,
    childTheme: null,
  });
  const themeAnalysis = readJson(THEME_ANALYSIS_PATH, null);
  const themeConversion = readJson(THEME_CONVERSION_PATH, null);
  const parityReport = existsSync(THEME_PARITY_REPORT_PATH) ? readJson(THEME_PARITY_REPORT_PATH, null) : null;
  const sourceUrl = normalizeBase(flags.source || existingConfig.sourceUrl || report?.sourceUrl);

  if (!sourceUrl) {
    return fail("Pass --source <wordpress-url> or run wp:probe first so the report contains sourceUrl.");
  }

  await mkdir(MIGRATION_DIR, { recursive: true });

  const gates = buildGates({ mode, sourceUrl, report, reportPath, themeManifest, themeAnalysis, themeConversion, parityReport });
  const blockers = gates.filter((gate) => gate.required && gate.status === "fail");
  const warnings = gates.filter((gate) => gate.status === "warn").map((gate) => gate.message);
  const now = new Date().toISOString();
  const config = {
    version: 1,
    mode,
    sourceUrl,
    reportPath,
    themeManifestPath: THEME_MANIFEST_PATH,
    migrationPlanPath: MIGRATION_PLAN_MD_PATH,
    updatedAt: now,
  };

  const plan = {
    ok: blockers.length === 0,
    generatedAt: now,
    command,
    mode,
    sourceUrl,
    source: summarizeSource(report),
    inputs: {
      probeReport: existsSync(reportPath) ? reportPath : null,
      themeManifest: existsSync(THEME_MANIFEST_PATH) ? THEME_MANIFEST_PATH : null,
      themeAnalysis: existsSync(THEME_ANALYSIS_PATH) ? THEME_ANALYSIS_PATH : null,
      themeConversion: existsSync(THEME_CONVERSION_PATH) ? THEME_CONVERSION_PATH : null,
      themeParityReport: existsSync(THEME_PARITY_REPORT_PATH) ? THEME_PARITY_REPORT_PATH : null,
      activeThemeZip: themeManifest.activeTheme || null,
      childThemeZip: themeManifest.childTheme || null,
    },
    gates,
    blockers,
    warnings,
    phases: buildPhases(mode),
    artifacts: {
      config: MIGRATION_CONFIG_PATH,
      themeManifest: THEME_MANIFEST_PATH,
      themeAnalysis: THEME_ANALYSIS_PATH,
      themeConversion: THEME_CONVERSION_PATH,
      capturePlan: CAPTURE_PLAN_PATH,
      planJson: MIGRATION_PLAN_JSON_PATH,
      planMarkdown: MIGRATION_PLAN_MD_PATH,
      validationReport: THEME_PARITY_REPORT_PATH,
    },
    nextCommands: buildNextCommands({
      mode,
      sourceUrl,
      reportPath,
      hasReport: Boolean(report),
      hasTheme: Boolean(themeManifest.activeTheme),
      hasThemeAnalysis: Boolean(themeAnalysis?.themes?.activeTheme),
      hasThemeConversion: Boolean(themeConversion),
      hasParityReport: Boolean(parityReport),
      parityLaunchReady: isParityLaunchReady(parityReport),
    }),
  };

  await writeJson(MIGRATION_CONFIG_PATH, config);
  await writeJson(MIGRATION_PLAN_JSON_PATH, plan);
  await writeFile(MIGRATION_PLAN_MD_PATH, formatPlanMarkdown(plan), "utf8");

  return { ok: plan.ok, data: plan };
}

function migrationStatus() {
  const config = readJson(MIGRATION_CONFIG_PATH, null);
  const themeManifest = readJson(THEME_MANIFEST_PATH, null);
  const themeAnalysis = readJson(THEME_ANALYSIS_PATH, null);
  const themeConversion = readJson(THEME_CONVERSION_PATH, null);
  const plan = readJson(MIGRATION_PLAN_JSON_PATH, null);
  const reportPath = config?.reportPath || DEFAULT_PROBE_REPORT;
  const parityReport = existsSync(THEME_PARITY_REPORT_PATH) ? readJson(THEME_PARITY_REPORT_PATH, null) : null;

  const checks = [
    statusCheck("migration-config", Boolean(config), MIGRATION_CONFIG_PATH),
    statusCheck("probe-report", existsSync(reportPath), reportPath),
    statusCheck("theme-manifest", Boolean(themeManifest), THEME_MANIFEST_PATH),
    statusCheck("theme-analysis", Boolean(themeAnalysis?.themes?.activeTheme), THEME_ANALYSIS_PATH),
    statusCheck("theme-conversion", Boolean(themeConversion), THEME_CONVERSION_PATH),
    statusCheck("theme-parity-report", Boolean(parityReport), THEME_PARITY_REPORT_PATH),
    statusCheck("migration-plan", Boolean(plan), MIGRATION_PLAN_MD_PATH),
  ];

  const mode = config?.mode || plan?.mode || "not configured";
  const sourceUrl = config?.sourceUrl || plan?.sourceUrl || null;
  const next = sourceUrl
    ? buildNextCommands({
      mode,
      sourceUrl,
      reportPath,
      hasReport: existsSync(reportPath),
      hasTheme: Boolean(themeManifest?.activeTheme),
      hasThemeAnalysis: Boolean(themeAnalysis?.themes?.activeTheme),
      hasThemeConversion: Boolean(themeConversion),
      hasParityReport: Boolean(parityReport),
      parityLaunchReady: isParityLaunchReady(parityReport),
    })
    : plan?.nextCommands || [
      "Run npm run microservices -- wp migrate --source <wordpress-url> --theme ./theme.zip.",
    ];

  return {
    ok: checks.some((check) => check.status === "pass"),
    data: {
      stage: migrationStage({ config, reportPath, themeManifest, themeAnalysis, themeConversion, parityReport }),
      mode,
      sourceUrl,
      checks,
      next,
    },
  };
}

function buildGates({ mode, sourceUrl, report, reportPath, themeManifest, themeAnalysis, themeConversion, parityReport }) {
  const standard = mode !== "content-only";
  const exporterInstalled = report?.emdashExporter?.installed;
  const authOk = report?.auth?.ok;
  const authAttempted = report?.auth?.attempted;
  const activeThemeAnalysis = themeAnalysis?.themes?.activeTheme;
  const parityScore = Number(parityReport?.score ?? parityReport?.totalScore ?? parityReport?.summary?.score ?? 0);
  const criticalFailures = parityReport ? normalizeCriticalFailures(parityReport) : [];

  return [
    sourceUrlGate(sourceUrl),
    probeReportGate(report, reportPath),
    applicationPasswordGate({ standard, authOk, authAttempted }),
    exporterGate({ standard, report, exporterInstalled }),
    themeZipGate({ standard, themeManifest }),
    themeAnalysisGate({ standard, activeThemeAnalysis }),
    themeConversionGate({ standard, themeConversion }),
    themeParityGate({ standard, parityReport, parityScore, criticalFailures }),
    commerceScopeGate(report),
    customPostTypesGate(report),
  ];
}

function sourceUrlGate(sourceUrl) {
  if (sourceUrl) {
    return {
      id: "source-url",
      status: "pass",
      required: true,
      message: `Source set to ${sourceUrl}.`,
    };
  }

  return {
    id: "source-url",
    status: "fail",
    required: true,
    message: "WordPress source URL is required.",
  };
}

function probeReportGate(report, reportPath) {
  if (report) {
    return {
      id: "probe-report",
      status: "pass",
      required: false,
      message: `Probe report found at ${reportPath}.`,
    };
  }

  return {
    id: "probe-report",
    status: "warn",
    required: false,
    message: `Probe report not found at ${reportPath}; run wp:probe before import.`,
  };
}

function applicationPasswordGate({ standard, authOk, authAttempted }) {
  if (authOk) {
    return {
      id: "application-password",
      status: "pass",
      required: Boolean(standard && authAttempted),
      message: "Application Password probe succeeded.",
    };
  }

  if (authAttempted) {
    return {
      id: "application-password",
      status: "fail",
      required: Boolean(standard && authAttempted),
      message: "Application Password probe failed.",
    };
  }

  return {
    id: "application-password",
    status: "warn",
    required: false,
    message: "Application Password not verified yet; enter it only through environment/stdin.",
  };
}

function exporterGate({ standard, report, exporterInstalled }) {
  if (exporterInstalled) {
    return {
      id: "emdash-exporter",
      status: "pass",
      required: Boolean(standard && report),
      message: "EmDash Exporter plugin detected.",
    };
  }

  if (report) {
    return {
      id: "emdash-exporter",
      status: "fail",
      required: Boolean(standard && report),
      message: "EmDash Exporter plugin was not detected; install it for standard migration.",
    };
  }

  return {
    id: "emdash-exporter",
    status: "warn",
    required: false,
    message: "EmDash Exporter status unknown until the probe runs.",
  };
}

function themeZipGate({ standard, themeManifest }) {
  if (themeManifest.activeTheme) {
    return {
      id: "theme-zip",
      status: "pass",
      required: standard,
      message: `Active theme ZIP captured at ${themeManifest.activeTheme.storedPath}.`,
    };
  }

  if (standard) {
    return {
      id: "theme-zip",
      status: "fail",
      required: true,
      message: "theme.zip is required for standard design-preserved migration.",
    };
  }

  return {
    id: "theme-zip",
    status: "warn",
    required: false,
    message: "No theme ZIP provided; content-only migration will use the default Astro/EmDash design.",
  };
}

function themeAnalysisGate({ standard, activeThemeAnalysis }) {
  if (activeThemeAnalysis) {
    return {
      id: "theme-analysis",
      status: activeThemeAnalysis.status === "fail" ? "fail" : "pass",
      required: standard,
      message: `Theme analysis ${activeThemeAnalysis.status}; detected ${activeThemeAnalysis.themeType} theme at ${activeThemeAnalysis.primaryRoot || "unknown root"}.`,
    };
  }

  if (standard) {
    return {
      id: "theme-analysis",
      status: "fail",
      required: true,
      message: "Theme analysis is required before AI conversion.",
    };
  }

  return {
    id: "theme-analysis",
    status: "warn",
    required: false,
    message: "Theme analysis is skipped for content-only migration.",
  };
}

function themeConversionGate({ standard, themeConversion }) {
  if (!standard) {
    return {
      id: "theme-conversion",
      status: "warn",
      required: false,
      message: "Theme conversion is not part of content-only migration.",
    };
  }

  if (themeConversion) {
    return {
      id: "theme-conversion",
      status: "pass",
      required: false,
      message: "Theme conversion handoff exists.",
    };
  }

  return {
    id: "theme-conversion",
    status: "warn",
    required: false,
    message: "Theme conversion handoff has not been generated yet.",
  };
}

function themeParityGate({ standard, parityReport, parityScore, criticalFailures }) {
  if (!standard) {
    return {
      id: "theme-parity",
      status: "warn",
      required: false,
      message: "Theme parity validation is not part of content-only migration.",
    };
  }

  if (parityReport) {
    const launchReady = parityScore >= 85 && criticalFailures.length === 0;
    return {
      id: "theme-parity",
      status: launchReady ? "pass" : "warn",
      required: false,
      message: `Theme parity score ${parityScore}/100 with ${criticalFailures.length} critical failure(s).`,
    };
  }

  return {
    id: "theme-parity",
    status: "warn",
    required: false,
    message: "Theme parity report missing; run wp validate-theme after conversion.",
  };
}

function commerceScopeGate(report) {
  if (!report) {
    return {
      id: "commerce-scope",
      status: "warn",
      required: false,
      message: "Commerce scope is unknown until the probe runs.",
    };
  }

  if (report.detection?.hasWooCommerce) {
    return {
      id: "commerce-scope",
      status: "warn",
      required: false,
      message: "WooCommerce detected; commerce flows are outside this blog migration template.",
    };
  }

  return {
    id: "commerce-scope",
    status: "pass",
    required: false,
    message: "WooCommerce was not detected in the probe report.",
  };
}

function customPostTypesGate(report) {
  if (!report) {
    return {
      id: "custom-post-types",
      status: "warn",
      required: false,
      message: "Custom post type scope is unknown until the probe runs.",
    };
  }

  const unsupportedTypes = report.detection?.unsupportedTypes || [];
  if (unsupportedTypes.length > 0) {
    return {
      id: "custom-post-types",
      status: "warn",
      required: false,
      message: `Custom post types need mapping: ${unsupportedTypes.join(", ")}.`,
    };
  }

  return {
    id: "custom-post-types",
    status: "pass",
    required: false,
    message: "No unsupported custom post types were reported.",
  };
}

function buildPhases(mode) {
  const phases = [
    {
      id: "probe",
      title: "Probe WordPress",
      outcome: "REST/API reachability, auth, exporter, theme, plugin, content counts, and unsupported surface are known.",
    },
    {
      id: "export-content",
      title: "Export Content",
      outcome: "Use EmDash Exporter for structured content/media/schema export; keep WXR as fallback.",
    },
    {
      id: "import-content",
      title: "Import Into EmDash",
      outcome: "Posts, pages, authors, taxonomies, media, SEO metadata, and redirects land in EmDash.",
    },
  ];

  if (mode !== "content-only") {
    phases.splice(2, 0, {
      id: "analyze-theme",
      title: "Analyze Theme ZIP",
      outcome: "Validate archive integrity, detect classic/block theme structure, inventory templates/assets, and flag unsupported surfaces.",
    });
    phases.splice(3, 0, {
      id: "convert-theme",
      title: "Convert Theme",
      outcome: "Unpack theme.zip, map WordPress templates to Astro routes/components, and preserve CSS/assets.",
    });
  }

  phases.push(
    {
      id: "capture",
      title: "Capture References",
      outcome: "Capture source and rebuilt pages at fixed widths, or record an explicit browser-capture blocker.",
    },
    {
      id: "validate",
      title: "Validate",
      outcome: "Run content parity, route parity, responsive screenshots, visual diff, accessibility, and performance checks.",
    },
    {
      id: "deploy",
      title: "Deploy Preview",
      outcome: "Deploy Astro SSR + EmDash to Cloudflare Workers with D1, R2, cache headers, and preview URL.",
    },
    {
      id: "cutover",
      title: "Cut Over",
      outcome: "Apply redirects, verify canonical URLs/sitemap/robots, switch DNS, revoke App Password, and remove exporter.",
    },
  );

  return phases;
}

function buildNextCommands({ mode, sourceUrl, reportPath, hasReport, hasTheme, hasThemeAnalysis, hasThemeConversion, hasParityReport, parityLaunchReady }) {
  const commands = [];

  if (!hasReport) {
    commands.push(`npm run microservices -- wp probe --source ${sourceUrl} --out ${reportPath} --password-prompt`);
    commands.push(`npm run wp:verify -- --report ${reportPath}`);
  }

  if (mode !== "content-only" && !hasTheme) {
    commands.push("npm run microservices -- wp add-theme ./theme.zip");
  }

  if (mode !== "content-only" && hasTheme && !hasThemeAnalysis) {
    commands.push("npm run microservices -- wp analyze-theme");
  }

  commands.push("npm run microservices -- wp plan");

  if (mode !== "content-only" && hasThemeAnalysis && !hasThemeConversion) {
    commands.push("npm run microservices -- wp convert-theme --pages /,/blog,/sample-post");
  }

  commands.push("npm run dev");

  if (mode !== "content-only" && hasThemeConversion) {
    commands.push("npm run microservices -- wp capture --rebuilt http://localhost:4321 --run");
    commands.push("npm run microservices -- wp diff-theme");
  }

  if (mode !== "content-only" && (!hasParityReport || !parityLaunchReady)) {
    commands.push("npm run microservices -- wp validate-theme");
  }

  commands.push("npm run build");

  if (mode === "content-only" || parityLaunchReady) {
    commands.push("npm run deploy");
  } else {
    commands.push("Fix theme parity before deploy/cutover.");
  }

  return commands;
}

function summarizeSource(report) {
  if (!report) {
    return {
      classification: "unknown",
      counts: null,
      activeTheme: [],
      activePlugins: [],
      emdashExporter: { installed: null },
    };
  }

  return {
    classification: report.detection?.classification || "unknown",
    counts: report.counts || null,
    activeTheme: report.activeTheme || [],
    activePlugins: report.activePlugins || [],
    emdashExporter: report.emdashExporter || { installed: null },
    unsupportedTypes: report.detection?.unsupportedTypes || [],
    hasWooCommerce: Boolean(report.detection?.hasWooCommerce),
  };
}

function resolveMode(flags) {
  if (flags["content-only"]) return "content-only";
  if (flags.advanced) return "advanced";
  if (flags.mode) return String(flags.mode);
  return "standard";
}

function statusCheck(id, condition, path) {
  return {
    id,
    status: condition ? "pass" : "missing",
    path,
  };
}

async function writeJson(path, value) {
  await mkdir(dirname(resolve(path)), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function sha256File(path) {
  const hash = createHash("sha256");
  await new Promise((resolvePromise, reject) => {
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolvePromise);
  });
  return hash.digest("hex");
}

function normalizeBase(value) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function relativePath(path) {
  const cwd = process.cwd();
  return path.startsWith(`${cwd}/`) ? path.slice(cwd.length + 1) : path;
}

function formatBytes(value) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function hasZipSignature(path) {
  const descriptor = openSync(path, "r");
  try {
    const header = Buffer.alloc(4);
    const bytes = readSync(descriptor, header, 0, 4, 0);
    return bytes === 4
      && header[0] === 0x50
      && header[1] === 0x4b
      && (
        (header[2] === 0x03 && header[3] === 0x04)
        || (header[2] === 0x05 && header[3] === 0x06)
        || (header[2] === 0x07 && header[3] === 0x08)
      );
  } finally {
    closeSync(descriptor);
  }
}

async function analyzeThemeArchive(inputPath) {
  const sourcePath = resolve(inputPath);
  if (!existsSync(sourcePath)) return fail(`Theme ZIP not found: ${inputPath}`);
  if (extname(sourcePath).toLowerCase() !== ".zip") return fail("Theme source must be a .zip file.");
  if (!hasZipSignature(sourcePath)) return fail("Theme source does not look like a valid ZIP archive.");

  const sourceStat = await stat(sourcePath);
  const testResult = await runBuffered("unzip", ["-t", sourcePath], { maxBytes: 1024 * 1024 });
  if (testResult.error) return fail(`Unable to inspect ZIP archive. Install unzip first. ${testResult.error}`);
  if (testResult.code !== 0) return fail(`Theme ZIP failed archive integrity check: ${firstUsefulLine(testResult.stderr || testResult.stdout)}`);

  const listResult = await runBuffered("unzip", ["-Z1", sourcePath], { maxBytes: 20 * 1024 * 1024 });
  if (listResult.error) return fail(`Unable to list ZIP archive entries. ${listResult.error}`);
  if (listResult.code !== 0) return fail(`Unable to list ZIP archive entries: ${firstUsefulLine(listResult.stderr || listResult.stdout)}`);

  const entries = listResult.stdout
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry) => !entry.endsWith("/"));
  const directories = listResult.stdout
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.endsWith("/"));
  const rawStyleEntries = entries.filter((entry) => basename(entry).toLowerCase() === "style.css");
  const styleEntries = rawStyleEntries.filter((entry) => !isArchiveBaggagePath(entry));
  const candidates = [];

  for (const styleEntry of styleEntries.slice(0, 20)) {
    const root = dirname(styleEntry) === "." ? "" : dirname(styleEntry);
    const prefix = root ? `${root}/` : "";
    const scopedEntries = entries.filter((entry) => entry.startsWith(prefix) && !isArchiveBaggagePath(entry));
    const scopedDirectories = directories.filter((entry) => entry.startsWith(prefix) && !isArchiveBaggagePath(entry));
    const styleCss = await readZipEntry(sourcePath, styleEntry);
    const themeHeader = parseThemeHeader(styleCss);
    const classicTemplates = [
      "index.php",
      "front-page.php",
      "home.php",
      "single.php",
      "page.php",
      "archive.php",
      "header.php",
      "footer.php",
      "functions.php",
    ].filter((file) => scopedEntries.includes(`${prefix}${file}`));
    const blockTemplates = scopedEntries.filter((entry) => entry.startsWith(`${prefix}templates/`) && entry.endsWith(".html"));
    const blockParts = scopedEntries.filter((entry) => entry.startsWith(`${prefix}parts/`) && entry.endsWith(".html"));
    const blockJson = scopedEntries.filter((entry) => basename(entry) === "block.json");
    const renderPhp = scopedEntries.filter((entry) => basename(entry) === "render.php");
    const assetDirectories = ["assets", "css", "js", "build", "fonts", "images", "inc"]
      .filter((folder) => scopedDirectories.some((entry) => entry.startsWith(`${prefix}${folder}/`)) || scopedEntries.some((entry) => entry.startsWith(`${prefix}${folder}/`)));
    const hasThemeJson = scopedEntries.includes(`${prefix}theme.json`);
    const themeType = detectThemeType({ classicTemplates, blockTemplates, blockParts, hasThemeJson, blockJson });

    candidates.push({
      root: root || ".",
      styleEntry,
      themeHeader,
      themeType,
      hasThemeJson,
      classicTemplates,
      blockTemplates: blockTemplates.slice(0, 50),
      blockTemplateCount: blockTemplates.length,
      blockParts: blockParts.slice(0, 50),
      blockPartCount: blockParts.length,
      blockJsonCount: blockJson.length,
      renderPhpCount: renderPhp.length,
      assetDirectories,
    });
  }

  const primary = choosePrimaryThemeCandidate(candidates, sourcePath);
  const warnings = [];
  const blockers = [];
  const baggage = {
    nodeModules: entries.some((entry) => hasPathSegment(entry, "node_modules")),
    macosx: entries.some((entry) => hasPathSegment(entry, "__MACOSX")),
    vendor: entries.some((entry) => hasPathSegment(entry, "vendor")),
  };

  if (!styleEntries.length) blockers.push("No WordPress theme style.css file was found.");
  if (rawStyleEntries.length > styleEntries.length) warnings.push(`Ignored ${rawStyleEntries.length - styleEntries.length} style.css file(s) inside dependencies or archive metadata.`);
  if (styleEntries.length > 1) warnings.push(`Multiple style.css files found (${styleEntries.length}); confirm the active theme root.`);
  if (sourceStat.size > 100 * 1024 * 1024) warnings.push(`Theme ZIP is large (${formatBytes(sourceStat.size)}); remove backups/build artifacts before customer handoff when possible.`);
  if (entries.length > 5000) warnings.push(`Theme ZIP contains ${entries.length} files; conversion agents should ignore generated dependencies and caches.`);
  if (baggage.nodeModules) warnings.push("Archive includes node_modules; ignore it during conversion.");
  if (baggage.macosx) warnings.push("Archive includes __MACOSX metadata; ignore it during conversion.");
  if (baggage.vendor) warnings.push("Archive includes vendor dependencies; audit before copying any runtime code.");
  if (primary && primary.themeType === "unknown") warnings.push("Theme type is unclear; inspect templates manually before conversion.");

  const status = themeAnalysisStatus(blockers, warnings);
  const data = {
    version: 1,
    analyzedAt: new Date().toISOString(),
    archive: {
      path: relativePath(sourcePath),
      fileName: basename(sourcePath),
      sizeBytes: sourceStat.size,
      sha256: await sha256File(sourcePath),
      entryCount: entries.length,
      directoryCount: directories.length,
      listTruncated: listResult.truncated,
    },
    status,
    primaryRoot: primary?.root || null,
    themeType: primary?.themeType || "unknown",
    candidateCount: candidates.length,
    candidates,
    baggage,
    warnings,
    blockers,
  };

  return blockers.length ? { ok: false, error: blockers.join(" "), data } : { ok: true, data };
}

function themeAnalysisStatus(blockers, warnings) {
  if (blockers.length > 0) return "fail";
  if (warnings.length > 0) return "warn";
  return "pass";
}

async function writeThemeAnalysis(kind, analysis) {
  const existing = readJson(THEME_ANALYSIS_PATH, { version: 1, themes: {} });
  const report = {
    version: 1,
    updatedAt: new Date().toISOString(),
    themes: {
      ...(existing.themes || {}),
      [kind]: analysis,
    },
  };
  await writeJson(THEME_ANALYSIS_PATH, report);
}

function summarizeThemeAnalysis(analysis) {
  return {
    status: analysis.status,
    primaryRoot: analysis.primaryRoot,
    themeType: analysis.themeType,
    candidateCount: analysis.candidateCount,
    warnings: analysis.warnings || [],
    blockers: analysis.blockers || [],
  };
}

function choosePrimaryThemeCandidate(candidates, sourcePath) {
  if (!candidates.length) return null;
  if (candidates.length === 1) return candidates[0];

  const zipName = basename(sourcePath, ".zip").toLowerCase();
  const byZipName = candidates.find((candidate) => basename(candidate.root).toLowerCase() === zipName);
  if (byZipName) return byZipName;

  return [...candidates].sort((left, right) => candidateWeight(right) - candidateWeight(left))[0];
}

function candidateWeight(candidate) {
  return [
    candidate.themeHeader?.name ? 10 : 0,
    candidate.hasThemeJson ? 8 : 0,
    candidate.blockTemplateCount ? 6 : 0,
    candidate.classicTemplates.length ? 5 : 0,
    candidate.classicTemplates.includes("functions.php") ? 3 : 0,
  ].reduce((sum, value) => sum + value, 0);
}

function detectThemeType({ classicTemplates, blockTemplates, blockParts, hasThemeJson, blockJson }) {
  const hasClassic = classicTemplates.some((file) => file.endsWith(".php"));
  const hasBlocks = hasThemeJson || blockTemplates.length > 0 || blockParts.length > 0 || blockJson.length > 0;
  if (hasClassic && hasBlocks) return "hybrid";
  if (hasBlocks) return "block";
  if (hasClassic) return "classic";
  return "unknown";
}

function parseThemeHeader(css) {
  const header = {};
  const fields = {
    name: "Theme Name",
    uri: "Theme URI",
    author: "Author",
    version: "Version",
    template: "Template",
    textDomain: "Text Domain",
  };

  for (const [key, label] of Object.entries(fields)) {
    const match = css.match(new RegExp(`^\\s*${label}:\\s*(.+)$`, "im"));
    if (match) header[key] = match[1].trim();
  }

  return header;
}

function isArchiveBaggagePath(entry) {
  return hasPathSegment(entry, "node_modules")
    || hasPathSegment(entry, "__MACOSX")
    || hasPathSegment(entry, ".git")
    || hasPathSegment(entry, ".cache");
}

function hasPathSegment(entry, segment) {
  return String(entry).split("/").includes(segment);
}

async function readZipEntry(path, entry) {
  const result = await runBuffered("unzip", ["-p", path, entry], { maxBytes: 128 * 1024 });
  return result.code === 0 ? result.stdout : "";
}

async function runBuffered(command, args, options = {}) {
  const maxBytes = options.maxBytes || 1024 * 1024;
  return await new Promise((resolvePromise) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let truncated = false;

    child.stdout.on("data", (chunk) => {
      const next = chunk.toString();
      if (stdout.length + next.length <= maxBytes) stdout += next;
      else truncated = true;
    });
    child.stderr.on("data", (chunk) => {
      const next = chunk.toString();
      if (stderr.length + next.length <= maxBytes) stderr += next;
      else truncated = true;
    });
    child.on("error", (error) => {
      resolvePromise({ code: null, stdout, stderr, error: error.message, truncated });
    });
    child.on("close", (code) => {
      resolvePromise({ code, stdout, stderr, error: null, truncated });
    });
  });
}

async function runInherited(command, args, env) {
  return await new Promise((resolvePromise) => {
    const child = spawn(command, args, { stdio: "inherit", env });
    child.on("error", (error) => {
      process.stderr.write(`Error: ${error.message}\n`);
      resolvePromise(1);
    });
    child.on("close", (code) => resolvePromise(code ?? 1));
  });
}

async function readAllStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

async function promptHidden(prompt) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Secure prompt requires an interactive terminal. Use --password-stdin in non-interactive environments.");
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  process.stdout.write(prompt);
  const disabled = spawnSync("stty", ["-echo"], { stdio: ["inherit", "ignore", "ignore"] });
  if (disabled.status !== 0) {
    rl.close();
    throw new Error("Unable to disable terminal echo. Use --password-stdin instead.");
  }
  try {
    const value = await rl.question("");
    process.stdout.write("\n");
    return value.trim();
  } finally {
    spawnSync("stty", ["echo"], { stdio: ["inherit", "ignore", "ignore"] });
    rl.close();
  }
}

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseWidths(value) {
  const widths = parseCsv(value)
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0);
  return widths.length ? widths : DEFAULT_CAPTURE_WIDTHS;
}

function expectedScreenshotFiles({ pages, widths }) {
  return pages.flatMap((page) => widths.flatMap((width) => [
    screenshotPath({ target: "source", page, width }),
    screenshotPath({ target: "rebuilt", page, width }),
  ]));
}

function screenshotPath({ target, page, width }) {
  return `migration-reports/screenshots/${target}/${pageSlug(page)}-${width}.png`;
}

function pageSlug(page) {
  return String(page)
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\/|\/$/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    || "home";
}

function composeUrl(baseUrl, page) {
  if (/^https?:\/\//i.test(page)) return page;
  return new URL(page.startsWith("/") ? page : `/${page}`, baseUrl).toString();
}

function average(values) {
  const numeric = values.filter((value) => Number.isFinite(value));
  return numeric.length ? numeric.reduce((sum, value) => sum + value, 0) / numeric.length : 0;
}

function normalizeCriticalFailures(report) {
  if (Array.isArray(report.criticalFailures)) return report.criticalFailures.filter(Boolean);
  if (Array.isArray(report.critical)) return report.critical.filter(Boolean);
  if (Array.isArray(report.gates)) {
    return report.gates
      .filter((gate) => gate.critical && gate.status === "fail")
      .map((gate) => gate.id || gate.message || "critical gate failed");
  }
  return [];
}

function isParityLaunchReady(report) {
  if (!report) return false;
  const score = Number(report.score ?? report.totalScore ?? report.summary?.score ?? 0);
  return score >= 85 && normalizeCriticalFailures(report).length === 0;
}

function migrationStage({ config, reportPath, themeManifest, themeAnalysis, themeConversion, parityReport }) {
  if (!config) return "not-configured";
  if (!existsSync(reportPath)) return "source-configured";
  if (config.mode !== "content-only" && !themeManifest?.activeTheme) return "needs-theme-zip";
  if (config.mode !== "content-only" && !themeAnalysis?.themes?.activeTheme) return "theme-captured";
  if (config.mode !== "content-only" && !themeConversion) return "theme-analyzed";
  if (config.mode !== "content-only" && !parityReport) return "ready-for-conversion-review";
  if (config.mode !== "content-only") {
    return isParityLaunchReady(parityReport) ? "launch-ready" : "needs-theme-fixes";
  }
  return "content-ready";
}

function firstUsefulLine(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) || "unknown error";
}

function formatThemeResult(result) {
  if (!result.ok) return `${result.error}\n`;
  const theme = result.data.theme;
  const lines = [
    `Theme ZIP captured: ${theme.fileName}`,
    `Kind: ${theme.kind}`,
    `Stored: ${theme.storedPath}`,
    `Size: ${formatBytes(theme.sizeBytes)}`,
    `SHA-256: ${theme.sha256}`,
    `Analysis: ${formatThemeAnalysisSummary(theme.analysis)}`,
  ];

  if (theme.analysis?.warnings?.length) {
    lines.push("Warnings:", ...theme.analysis.warnings.map((warning) => `  - ${warning}`));
  }

  lines.push(
    "",
    "Next:",
    ...result.data.next.map((item) => `  - ${item}`),
    "",
  );

  return lines.join("\n");
}

function formatThemeAnalysisSummary(analysis) {
  if (!analysis) return "not run";
  if (!analysis.themeType) return analysis.status || "not run";
  return `${analysis.status} (${analysis.themeType})`;
}

function formatThemeAnalysisResult(result) {
  if (!result.ok) return `${result.error}\n`;
  const analysis = result.data.analysis;
  const lines = [
    `Theme analysis: ${analysis.status}`,
    `Kind: ${result.data.kind}`,
    `Report: ${result.data.analysisPath}`,
    `Primary root: ${analysis.primaryRoot || "unknown"}`,
    `Theme type: ${analysis.themeType}`,
    `Candidates: ${analysis.candidateCount}`,
    `Files: ${analysis.archive.entryCount}`,
  ];

  if (analysis.warnings.length) lines.push("", "Warnings:", ...analysis.warnings.map((warning) => `  - ${warning}`));
  if (analysis.blockers.length) lines.push("", "Blockers:", ...analysis.blockers.map((blocker) => `  - ${blocker}`));

  lines.push("", "Next:", ...result.data.next.map((item) => `  - ${item}`), "");
  return lines.join("\n");
}

function formatThemeConversionResult(result) {
  if (!result.ok) return `${result.error}\n`;
  return [
    `Theme conversion handoff: ${result.data.status}`,
    `Mode: ${result.data.mode}`,
    `Report: ${THEME_CONVERSION_PATH}`,
    `Pages: ${result.data.pages.join(", ")}`,
    "",
    "Next:",
    ...result.data.next.map((item) => `  - ${item}`),
    "",
  ].join("\n");
}

function formatCapturePlanResult(result) {
  if (!result.ok && !result.data) return `${result.error}\n`;
  const lines = [
    `Capture plan: ${result.data.status}`,
    `Source: ${result.data.sourceUrl}`,
    `Rebuilt: ${result.data.rebuiltUrl}`,
    `Widths: ${result.data.widths.join(", ")}`,
    `Pages: ${result.data.pages.join(", ")}`,
    `Plan: ${CAPTURE_PLAN_PATH}`,
  ];

  if (result.data.capture) {
    lines.push(
      `Capture result: ${result.data.capture.data.status}`,
      `Browser: ${result.data.capture.data.browser}`,
      `Result: ${CAPTURE_RESULT_PATH}`,
      `Captured: ${result.data.capture.data.captures.filter((item) => item.status === "captured").length}/${result.data.capture.data.captures.length}`,
    );
  }

  lines.push("");
  return lines.join("\n");
}

function formatThemeDiffResult(result) {
  if (!result.ok && !result.data) return `${result.error}\n`;
  const data = result.data;
  return [
    `Theme diff report: ${data.launchReady ? "launch-ready" : "needs work"}`,
    `Report: ${data.reportPath}`,
    `Score: ${data.score}/${data.threshold}`,
    `Screenshots: ${data.screenshotStatus}`,
    `Compared pairs: ${data.screenshots.comparedPairs}/${data.screenshots.expectedPairs}`,
    `Critical failures: ${data.criticalFailures.length}`,
    "",
    "Next:",
    ...data.next.map((item) => `  - ${item}`),
    "",
  ].join("\n");
}

function formatThemeValidationResult(result) {
  if (!result.ok && !result.data) return `${result.error}\n`;
  const data = result.data;
  const lines = [
    `Theme validation: ${data.launchReady ? "launch-ready" : "needs work"}`,
    `Report: ${data.reportPath}`,
    `Score: ${data.score}/${data.threshold}`,
    `Critical failures: ${data.criticalFailures.length}`,
    `Screenshots: ${data.screenshotStatus || data.screenshots?.status || "unknown"}`,
  ];

  if (data.criticalFailures.length) lines.push("", "Critical:", ...data.criticalFailures.map((failure) => `  - ${failure}`));
  if (data.next?.length) lines.push("", "Next:", ...data.next.map((item) => `  - ${item}`), "");
  return lines.join("\n");
}

function formatPlanResult(result) {
  if (!result.ok && !result.data) return `${result.error}\n`;
  const plan = result.data;
  const lines = [
    `Migration plan: ${plan.ok ? "ready" : "blocked"}`,
    `Mode: ${plan.mode}`,
    `Source: ${plan.sourceUrl}`,
    `Plan: ${plan.artifacts.planMarkdown}`,
    "",
    "Gates:",
    ...plan.gates.map((gate) => `  - ${gate.id}: ${gate.status}${gate.required ? " required" : ""} - ${gate.message}`),
  ];

  if (plan.blockers.length) {
    lines.push("", "Blockers:", ...plan.blockers.map((gate) => `  - ${gate.message}`));
  }

  if (plan.nextCommands.length) {
    lines.push("", "Next commands:", ...plan.nextCommands.map((commandText) => `  ${commandText}`));
  }

  return `${lines.join("\n")}\n`;
}

function formatStatusResult(result) {
  const value = result.data;
  return [
    `Migration status: ${result.ok ? "configured" : "not configured"}`,
    `Stage: ${value.stage}`,
    `Mode: ${value.mode}`,
    `Source: ${value.sourceUrl || "not set"}`,
    "",
    "Artifacts:",
    ...value.checks.map((check) => `  - ${check.id}: ${check.status} - ${check.path}`),
    "",
    "Next:",
    ...value.next.map((commandText) => `  ${commandText}`),
    "",
  ].join("\n");
}

function formatPlanMarkdown(plan) {
  const lines = [
    "# WordPress To EmDash Migration Plan",
    "",
    `Generated: ${plan.generatedAt}`,
    `Mode: ${plan.mode}`,
    `Source: ${plan.sourceUrl}`,
    `Status: ${plan.ok ? "ready" : "blocked"}`,
    "",
    "## Source Summary",
    "",
    `- Classification: ${plan.source.classification}`,
    `- EmDash Exporter: ${formatDetectionState(plan.source.emdashExporter?.installed)}`,
    `- WooCommerce: ${plan.source.hasWooCommerce ? "detected" : "not detected"}`,
    `- Unsupported custom post types: ${formatListOrNone(plan.source.unsupportedTypes)}`,
    "",
    "## Gates",
    "",
    ...plan.gates.map((gate) => `- ${gate.id}: ${gate.status}${gate.required ? " required" : ""} - ${gate.message}`),
    "",
    "## Phases",
    "",
    ...plan.phases.map((phase, index) => `${index + 1}. ${phase.title}: ${phase.outcome}`),
    "",
    "## Next Commands",
    "",
    ...plan.nextCommands.map((commandText) => `- \`${commandText}\``),
    "",
  ];

  if (plan.blockers.length) {
    lines.splice(10, 0, "## Blockers", "", ...plan.blockers.map((gate) => `- ${gate.message}`), "");
  }

  return `${lines.join("\n")}\n`;
}

function formatDetectionState(value) {
  if (value === true) return "detected";
  if (value === false) return "not detected";
  return "unknown";
}

function formatListOrNone(values) {
  if (values?.length) return values.join(", ");
  return "none reported";
}

function formatHelp() {
  return (
    "wordpress-emdash-blog-astro project commands\n\n" +
    "  node scripts/microservices.js check [--json]                 Validate template files\n" +
    "  node scripts/microservices.js wp probe --source <url>         Probe WordPress with secure password options\n" +
    "  node scripts/microservices.js wp migrate --source <url>       Create a migration plan\n" +
    "  node scripts/microservices.js wp add-theme ./theme.zip        Capture required theme ZIP\n" +
    "  node scripts/microservices.js wp analyze-theme                Validate and inventory theme ZIP\n" +
    "  node scripts/microservices.js wp convert-theme                Generate AI conversion handoff\n" +
    "  node scripts/microservices.js wp capture --rebuilt <url>      Write or run screenshot capture plan\n" +
    "  node scripts/microservices.js wp diff-theme                   Generate screenshot parity report\n" +
    "  node scripts/microservices.js wp validate-theme               Check theme parity score\n" +
    "  node scripts/microservices.js wp plan                         Regenerate migration artifacts\n" +
    "  node scripts/microservices.js wp status                       Show migration artifact status\n" +
    "  npm run wp:verify -- --report <path>                          Summarize migration readiness\n" +
    "  npm run dev                                                   Start Astro/EmDash locally\n" +
    "  npm run deploy                                                Deploy to Cloudflare Workers\n"
  );
}

function formatWordPressHelp() {
  return (
    "WordPress migration commands\n\n" +
    "  npm run microservices -- wp probe --source <url> --username <user> --password-prompt --out migration-reports/wp-source-probe.json\n" +
    "      Probe WordPress using a secure local prompt. Use --password-stdin for CI/non-interactive runs.\n\n" +
    "  npm run microservices -- wp probe --source <url> --username <user> --password-stdin\n" +
    "      Read the Application Password from stdin, never from a command argument.\n\n" +
    "  npm run microservices -- wp migrate --source <url> --theme ./theme.zip\n" +
    "      Standard design-preserved migration. Requires EmDash Exporter and theme.zip.\n\n" +
    "  npm run microservices -- wp migrate --source <url> --content-only\n" +
    "      Content-only migration. Uses the default Astro/EmDash blog design.\n\n" +
    "  npm run microservices -- wp add-theme ./theme.zip [--child]\n" +
    "      Validate, copy, analyze, and checksum a theme ZIP into .migration/input.\n\n" +
    "  npm run microservices -- wp analyze-theme [./theme.zip]\n" +
    "      Validate archive integrity and inventory classic/block theme files.\n\n" +
    "  npm run microservices -- wp convert-theme --pages /,/blog,/sample-post\n" +
    "      Generate the AI-agent handoff for Astro theme conversion.\n\n" +
    "  npm run microservices -- wp capture --rebuilt http://localhost:4321 [--run]\n" +
    "      Create the source/rebuilt screenshot capture plan. With --run, capture screenshots using Playwright when available, otherwise Chrome CLI.\n\n" +
    "  npm run microservices -- wp diff-theme\n" +
    "      Compare captured PNG screenshots and write migration-reports/theme-parity.json.\n\n" +
    "  npm run microservices -- wp validate-theme --generate\n" +
    "      Generate theme parity from captured screenshots, then enforce score >=85 and no critical gates.\n\n" +
    "  npm run microservices -- wp validate-theme [--report migration-reports/theme-parity.json]\n" +
    "      Require score >=85 and no critical gates before launch.\n\n" +
    "  npm run microservices -- wp plan [--report migration-reports/wp-source-probe.json]\n" +
    "      Rebuild .migration/migration-plan.json and .migration/migration-plan.md.\n\n" +
    "  npm run microservices -- wp status\n" +
    "      Show available migration artifacts and next commands.\n"
  );
}

function parseCli(values) {
  const flags = {};
  const parsedPositionals = [];

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) {
      parsedPositionals.push(value);
      continue;
    }

    const inline = value.match(/^--([^=]+)=(.*)$/);
    if (inline) {
      flags[inline[1]] = inline[2];
      continue;
    }

    const key = value.slice(2);
    const next = values[index + 1];
    if (next && !next.startsWith("--")) {
      flags[key] = next;
      index += 1;
    } else {
      flags[key] = true;
    }
  }

  return { flags, positionals: parsedPositionals };
}

function fail(error) {
  return { ok: false, error };
}
