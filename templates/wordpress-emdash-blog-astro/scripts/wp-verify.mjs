#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const args = parseArgs(process.argv.slice(2));
const reportPath = args.report || "migration-reports/wp-source-probe.json";
let report;

try {
  report = JSON.parse(await readFile(reportPath, "utf8"));
} catch (error) {
  process.stderr.write(`Error: could not read probe report at ${reportPath}: ${error.message}\n`);
  process.exit(1);
}

const checks = [
  check("source-url", Boolean(report.sourceUrl), "Probe report has a source URL."),
  check("rest-counts", Number.isFinite(report.counts?.posts?.total) && Number.isFinite(report.counts?.pages?.total), "Probe report has REST counts."),
  check("auth", report.auth?.ok || !report.auth?.attempted, report.auth?.attempted ? "Application Password worked." : "Probe ran without auth."),
  check("content-present", (report.counts?.posts?.total || 0) + (report.counts?.pages?.total || 0) > 0, "Source has posts or pages."),
  check("commerce-reported", !report.detection?.hasWooCommerce || report.warnings?.some((warning) => warning.includes("WooCommerce")), "Commerce is absent or explicitly reported."),
  check("custom-types-reported", !report.detection?.unsupportedTypes?.length || report.warnings?.some((warning) => warning.includes("Custom post types")), "Custom post types are absent or explicitly reported."),
];

const ok = checks.every((item) => item.status === "pass");
const summary = {
  ok,
  sourceUrl: report.sourceUrl,
  classification: report.detection?.classification,
  expectedImport: {
    posts: report.counts?.posts?.total || 0,
    pages: report.counts?.pages?.total || 0,
    media: report.counts?.media?.total || 0,
    categories: report.counts?.categories?.total || 0,
    tags: report.counts?.tags?.total || 0,
  },
  excluded: {
    commerce: Boolean(report.detection?.hasWooCommerce),
    customPostTypes: report.detection?.unsupportedTypes || [],
  },
  checks,
};

if (args.json) {
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} else {
  process.stdout.write(format(summary));
}

process.exitCode = ok ? 0 : 1;

function check(id, condition, message) {
  return { id, status: condition ? "pass" : "fail", message };
}

function format(value) {
  return [
    `Migration verification: ${value.ok ? "pass" : "fail"}`,
    `Source: ${value.sourceUrl}`,
    `Classification: ${value.classification}`,
    "",
    "Expected content import:",
    `  posts: ${value.expectedImport.posts}`,
    `  pages: ${value.expectedImport.pages}`,
    `  media: ${value.expectedImport.media}`,
    `  categories: ${value.expectedImport.categories}`,
    `  tags: ${value.expectedImport.tags}`,
    "",
    "Excluded:",
    `  commerce: ${value.excluded.commerce ? "yes" : "no"}`,
    `  custom post types: ${value.excluded.customPostTypes.length ? value.excluded.customPostTypes.join(", ") : "none"}`,
    "",
    "Checks:",
    ...value.checks.map((item) => `  - ${item.id}: ${item.status} - ${item.message}`),
    "",
  ].join("\n");
}

function parseArgs(values) {
  const out = { report: null, json: false };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--report") {
      out.report = values[index + 1] || null;
      index += 1;
    } else if (value === "--json") {
      out.json = true;
    }
  }
  return out;
}
