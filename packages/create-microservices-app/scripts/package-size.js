#!/usr/bin/env node
import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const json = args.has("--json");

function parseBytes(value, fallback) {
  if (!value) return fallback;
  const match = String(value).trim().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/i);
  if (!match) return fallback;
  const amount = Number(match[1]);
  const unit = (match[2] || "b").toLowerCase();
  const multipliers = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 };
  return Math.round(amount * multipliers[unit]);
}

function formatBytes(bytes) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${bytes} B`;
}

async function walk(path) {
  const info = await stat(path);
  if (info.isFile()) return [{ path, bytes: info.size }];
  if (!info.isDirectory()) return [];

  const files = [];
  const entries = await readdir(path, { withFileTypes: true });
  for (const entry of entries) {
    files.push(...await walk(join(path, entry.name)));
  }
  return files;
}

function summarize(name, files) {
  const bytes = files.reduce((sum, file) => sum + file.bytes, 0);
  return { name, bytes, files: files.length };
}

function topByBytes(items, limit = 10) {
  return [...items].sort((a, b) => b.bytes - a.bytes).slice(0, limit);
}

async function filesUnder(relativePath) {
  const absolute = resolve(packageRoot, relativePath);
  if (!existsSync(absolute)) return null;
  return walk(absolute);
}

async function childDirectories(root) {
  if (!existsSync(root)) return [];
  const entries = await readdir(root, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(root, entry.name));
}

async function childDirectorySummaries(rootRelative) {
  const root = resolve(packageRoot, rootRelative);
  const summaries = [];

  for (const directory of await childDirectories(root)) {
    const files = await walk(directory);
    summaries.push(summarize(relative(packageRoot, directory), files));
  }

  return summaries;
}

async function templateModuleSummaries(rootRelative) {
  const root = resolve(packageRoot, rootRelative);
  const summaries = [];

  for (const templateDirectory of await childDirectories(root)) {
    const modulesRoot = join(templateDirectory, "modules");
    for (const moduleDirectory of await childDirectories(modulesRoot)) {
      const files = await walk(moduleDirectory);
      summaries.push(summarize(relative(packageRoot, moduleDirectory), files));
    }
  }

  return summaries;
}

const packageJson = JSON.parse(await readFile(resolve(packageRoot, "package.json"), "utf8"));
const includeRoots = packageJson.files ?? [];
const includes = [];
const missing = [];

for (const include of includeRoots) {
  const files = await filesUnder(include);
  if (!files) {
    missing.push(include);
    continue;
  }
  includes.push(summarize(include, files));
}

const totals = {
  bytes: includes.reduce((sum, item) => sum + item.bytes, 0),
  files: includes.reduce((sum, item) => sum + item.files, 0),
};
const thresholds = {
  bytes: parseBytes(process.env.MICROSERVICES_CREATE_PACK_MAX_BYTES, 100 * 1024 ** 2),
  files: Number(process.env.MICROSERVICES_CREATE_PACK_MAX_FILES || 10000),
};
const largestTemplates = topByBytes(await childDirectorySummaries("templates"), 8);
const largestTemplateModules = topByBytes(await templateModuleSummaries("templates"), 12);
const failures = [];

if (totals.bytes > thresholds.bytes) {
  failures.push(`package payload ${formatBytes(totals.bytes)} exceeds ${formatBytes(thresholds.bytes)}`);
}
if (totals.files > thresholds.files) {
  failures.push(`package payload ${totals.files} files exceeds ${thresholds.files}`);
}

const report = {
  ok: failures.length === 0,
  totals,
  thresholds,
  missingIncludes: missing,
  includes: topByBytes(includes, includeRoots.length),
  largestTemplates,
  largestTemplateModules,
  failures,
};

if (json) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  process.stdout.write(`create-microservices-app package payload\n`);
  process.stdout.write(`  unpacked: ${formatBytes(totals.bytes)} (${totals.files} files)\n`);
  process.stdout.write(`  limits:   ${formatBytes(thresholds.bytes)} (${thresholds.files} files)\n`);
  if (missing.length) process.stdout.write(`  missing:  ${missing.join(", ")}\n`);
  process.stdout.write(`\nLargest include roots:\n`);
  for (const item of report.includes) {
    process.stdout.write(`  ${item.name}: ${formatBytes(item.bytes)} (${item.files} files)\n`);
  }
  if (largestTemplates.length) {
    process.stdout.write(`\nLargest bundled templates:\n`);
    for (const item of largestTemplates) {
      process.stdout.write(`  ${item.name}: ${formatBytes(item.bytes)} (${item.files} files)\n`);
    }
  }
  if (largestTemplateModules.length) {
    process.stdout.write(`\nLargest vendored module copies:\n`);
    for (const item of largestTemplateModules) {
      process.stdout.write(`  ${item.name}: ${formatBytes(item.bytes)} (${item.files} files)\n`);
    }
  }
  if (failures.length) {
    process.stderr.write(`\nPackage size guard failed:\n${failures.map((failure) => `  - ${failure}`).join("\n")}\n`);
  }
}

process.exitCode = report.ok ? 0 : 1;
