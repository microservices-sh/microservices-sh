#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function ok(data, warnings = []) {
  return { ok: true, data, warnings };
}

function fail(code, message, remediation) {
  return { ok: false, error: { code, message, remediation } };
}

function emit(result, json) {
  if (json) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    process.exit(result.ok ? 0 : 1);
  }
  if (!result.ok) {
    process.stderr.write(`${result.error.message}\nNext: ${result.error.remediation}\n`);
    process.exit(1);
  }
  if (result.data?.checks) {
    for (const check of result.data.checks) {
      process.stdout.write(`${check.status.toUpperCase()} ${check.id}: ${check.message}\n`);
    }
  } else {
    process.stdout.write(`${JSON.stringify(result.data, null, 2)}\n`);
  }
}

function check() {
  const required = [
    "microservices.template.json",
    "microservices.lock.json",
    "package.json",
    "src/App.svelte",
    "src-tauri/tauri.conf.json",
    "src-tauri/src/main.rs"
  ];
  const checks = required.map((file) => {
    const fileExists = existsSync(join(ROOT, file));

    return {
      id: file,
      status: fileExists ? "pass" : "fail",
      message: fileExists ? `${file} present.` : `${file} missing.`
    };
  });
  const passed = checks.every((item) => item.status === "pass");
  return passed
    ? ok({ status: "pass", checks })
    : fail("CHECK_FAILED", "Desktop template check failed.", "Restore the missing MVP files.");
}

function status() {
  const configPath = join(ROOT, "microservices.config.json");
  const config = existsSync(configPath)
    ? JSON.parse(readFileSync(configPath, "utf8"))
    : {};
  return ok({
    template: "erp-shell-desktop-tauri",
    mode: config.desktop?.mode ?? "connected",
    syncBaseUrl: config.desktop?.syncBaseUrl ?? null,
    commands: ["check", "status"]
  });
}

const args = process.argv.slice(2);
const json = args.includes("--json");
const command = args.find((arg) => !arg.startsWith("--")) ?? "status";

if (command === "check") {
  emit(check(), json);
} else if (command === "status" || command === "help") {
  emit(status(), json);
} else {
  emit(fail("UNKNOWN_COMMAND", `Unknown command: ${command}`, "Use microservices check or microservices status."), json);
}
