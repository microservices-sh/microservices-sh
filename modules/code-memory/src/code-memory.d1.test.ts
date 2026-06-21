import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createTestD1 } from "@microservices-sh/test-utils";
import { createD1CodeMemoryStore } from "./adapters/d1";
import { createCodeMemoryService, createSequentialCodeMemoryIdFactory } from "./service";
import type { ModuleResult, TenantContext } from "./types";

const SCHEMA = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../migrations/0001_initial.sql"), "utf8");

function unwrap<T>(result: ModuleResult<T>): T {
  if (!result.ok || !result.data) throw new Error(result.error?.message ?? "Expected ok result");
  return result.data;
}

function service() {
  const { d1 } = createTestD1(SCHEMA);
  return createCodeMemoryService({
    store: createD1CodeMemoryStore(d1),
    createId: createSequentialCodeMemoryIdFactory()
  });
}

const ctx: TenantContext = {
  tenantId: "tenant_1",
  actorId: "user_1",
  now: "2026-01-01T00:00:00.000Z"
};

describe("D1 code-memory store", () => {
  it("persists source and capsule JSON fields through the service", async () => {
    const memory = service();
    const { source } = unwrap(
      await memory.addTrustedSource(ctx, {
        repoUrl: "https://github.com/acme/auth-kit",
        path: "src/auth",
        repoVisibility: "private"
      })
    );

    const { capsule } = unwrap(
      await memory.createLogicCapsule(ctx, {
        sourceId: source.id,
        name: "D1 pagination helper",
        purpose: "Paginate tenant-scoped D1 list queries.",
        files: ["src/auth/pagination.ts"],
        tests: ["src/auth/pagination.test.ts"],
        dependencies: ["zod"],
        constraints: ["Always include tenant_id in WHERE clauses."],
        approvalStatus: "approved"
      })
    );

    const fetched = unwrap(await memory.getLogicCapsule(ctx, capsule.slug)).capsule;
    expect(fetched.files).toEqual(["src/auth/pagination.ts"]);
    expect(fetched.tests).toEqual(["src/auth/pagination.test.ts"]);
    expect(fetched.dependencies).toEqual(["zod"]);
    expect(fetched.constraints).toEqual(["Always include tenant_id in WHERE clauses."]);
    expect(fetched.provenance.repoUrl).toBe("https://github.com/acme/auth-kit");

    const search = unwrap(await memory.searchLogicCapsules(ctx, { query: "pagination" }));
    expect(search.capsules.map((item) => item.slug)).toEqual(["d1-pagination-helper"]);
  });
});
