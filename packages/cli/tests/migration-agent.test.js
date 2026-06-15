import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";

const testDir = dirname(fileURLToPath(import.meta.url));
const cliPath = resolve(testDir, "../src/index.js");

function runCli(args, cwd) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      INIT_CWD: cwd,
    },
  });
}

function parseStdout(result) {
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`Invalid JSON stdout: ${error.message}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }
}

async function createProject() {
  const root = await mkdtemp(join(tmpdir(), "microservices-migration-agent-"));
  await writeFile(
    join(root, "package.json"),
    `${JSON.stringify(
      {
        name: "cosma-admin",
        type: "module",
        scripts: { build: "vite build" },
        dependencies: { react: "^19.0.0", vite: "^7.0.0" },
        devDependencies: {},
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  await writeFile(join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n", "utf8");
  return root;
}

function validReport(projectRoot) {
  return {
    schemaVersion: "2026-06-15",
    project: {
      name: "cosma-admin",
      path: projectRoot,
      framework: "vite-react",
      packageManager: "pnpm",
    },
    target: {
      provider: "cloudflare",
      mode: "hybrid",
    },
    readiness: {
      status: "needs_changes",
      score: 72,
    },
    findings: [
      {
        id: "build.static-spa",
        title: "Vite static SPA build is Cloudflare-hostable",
        status: "pass",
        confidence: "high",
        evidence: [{ file: "package.json", line: 5, summary: "Build script exists." }],
        recommendation: "Deploy dist with SPA fallback.",
      },
      {
        id: "functions.supabase-edge",
        title: "Admin functions should move behind Worker routes later",
        status: "warn",
        confidence: "high",
        evidence: [
          {
            file: "src/pages/admin/UsersPage.tsx",
            line: 34,
            summary: "Frontend calls Supabase Edge Function endpoint.",
          },
        ],
        recommendation: "Keep Supabase for phase 1, then migrate admin functions to same-origin Worker routes.",
      },
    ],
    recommendedPlan: [
      {
        id: "phase-1",
        title: "Cloudflare-enable hosting",
        summary: "Deploy static SPA on Cloudflare while preserving Supabase.",
      },
    ],
    requiredEnv: [
      { name: "VITE_SUPABASE_URL", scope: "public-build", required: true },
      { name: "SUPABASE_SERVICE_ROLE_KEY", scope: "worker-secret", required: false },
    ],
    suggestedBindings: [{ type: "r2", binding: "UPLOADS_BUCKET", reason: "Future audio migration." }],
    nextCommands: [
      "microservices prompt next --from-report .microservices/analysis/report.json --goal cloudflare-enable",
    ],
  };
}

describe("migration agent handoff CLI", () => {
  it("generates checklist/prompt files, validates a report, and writes a next prompt", async () => {
    const projectRoot = await createProject();
    try {
      const analyze = runCli(["analyze", ".", "--target", "cloudflare", "--agent", "--json"], projectRoot);
      expect(analyze.status).toBe(0);
      const analyzePayload = parseStdout(analyze);
      expect(analyzePayload.ok).toBe(true);
      expect(analyzePayload.data.project.framework).toBe("vite-react");

      const checklist = JSON.parse(await readFile(analyzePayload.data.checklistPath, "utf8"));
      expect(checklist.id).toBe("cloudflare-migration-checklist");
      expect(await readFile(analyzePayload.data.promptPath, "utf8")).toContain("Cloudflare Migration Analysis Agent Prompt");

      await writeFile(analyzePayload.data.reportPath, `${JSON.stringify(validReport(projectRoot), null, 2)}\n`, "utf8");

      const validate = runCli(["analyze", "report", analyzePayload.data.reportPath, "--json"], projectRoot);
      expect(validate.status).toBe(0);
      expect(parseStdout(validate).data.status).toBe("pass");

      const doctor = runCli(["doctor", "--from-report", analyzePayload.data.reportPath, "--json"], projectRoot);
      expect(doctor.status).toBe(0);
      const doctorPayload = parseStdout(doctor);
      expect(doctorPayload.ok).toBe(true);
      expect(doctorPayload.data.status).toBe("warn");
      expect(doctorPayload.data.warnings).toHaveLength(1);

      const next = runCli(
        ["prompt", "next", "--from-report", analyzePayload.data.reportPath, "--goal", "cloudflare-enable", "--json"],
        projectRoot
      );
      expect(next.status).toBe(0);
      const nextPayload = parseStdout(next);
      expect(nextPayload.ok).toBe(true);
      expect(await readFile(nextPayload.data.promptPath, "utf8")).toContain("Goal: Cloudflare-enable");
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it("rejects warning reports without evidence", async () => {
    const projectRoot = await createProject();
    try {
      const reportPath = join(projectRoot, "bad-report.json");
      const report = validReport(projectRoot);
      report.findings[1].evidence = [];
      await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

      const result = runCli(["doctor", "--from-report", reportPath, "--json"], projectRoot);
      expect(result.status).toBe(1);
      const payload = parseStdout(result);
      expect(payload.ok).toBe(false);
      expect(payload.error.code).toBe("MIGRATION_REPORT_SCHEMA_INVALID");
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });
});
