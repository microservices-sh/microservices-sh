import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createD1DocumentExtractionStore,
  createExtractionJob,
  listExtractionJobs,
  reviewExtraction,
  submitExtractionDraft
} from "./index";

const SCHEMA = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../migrations/0001_initial.sql"), "utf8");

function loadDatabaseSync(): any | null {
  try {
    const require = createRequire(import.meta.url);
    return require("node:sqlite").DatabaseSync;
  } catch {
    return null;
  }
}

function wrapAsD1(db: any): D1Database {
  const makeStmt = (sql: string, params: unknown[]) => ({
    bind(...nextParams: unknown[]) {
      return makeStmt(sql, nextParams);
    },
    async first<T = Record<string, unknown>>(col?: string): Promise<T | null> {
      const row = db.prepare(sql).get(...params);
      if (row == null) return null;
      return (col == null ? row : row[col]) as T;
    },
    async all<T = Record<string, unknown>>() {
      return { results: db.prepare(sql).all(...params) as T[], success: true, meta: {} };
    },
    async run() {
      const info = db.prepare(sql).run(...params);
      return { success: true, meta: { changes: info.changes, last_row_id: Number(info.lastInsertRowid) } };
    }
  });

  return {
    prepare(sql: string) {
      return makeStmt(sql, []);
    }
  } as unknown as D1Database;
}

const DatabaseSync = loadDatabaseSync();

describe.skipIf(!DatabaseSync)("D1DocumentExtractionStore", () => {
  let store: ReturnType<typeof createD1DocumentExtractionStore>;

  beforeEach(() => {
    const raw = new DatabaseSync(":memory:");
    raw.exec(SCHEMA);
    store = createD1DocumentExtractionStore(wrapAsD1(raw));
  });

  it("persists the extraction review lifecycle", async () => {
    const created = await createExtractionJob(
      {
        tenantId: "tenant_1",
        ownerId: "owner_1",
        source: { fileId: "file_1", mimeType: "application/pdf", originalName: "invoice.pdf", pageCount: 2, bytes: 840_000 },
        targetType: "invoice",
        schemaId: "invoice.v1",
        requestedMode: "hybrid",
        metadata: { source: "d1-test" }
      },
      { store }
    );
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error("expected created job");

    const submitted = await submitExtractionDraft(
      {
        jobId: created.data.job.id,
        tenantId: "tenant_1",
        draft: {
          schemaId: "invoice.v1",
          targetType: "invoice",
          fields: [
            { name: "vendor", value: "Acme Supplies", confidence: 0.96, source: { page: 1, text: "Acme Supplies" } },
            { name: "total", value: 3420.75, confidence: 0.91, source: { page: 2, text: "Total 3420.75" } }
          ],
          tables: [],
          rawText: "Acme Supplies\nTotal 3420.75",
          confidence: 0.93,
          runtime: "sidecar",
          model: "gemma4:12b-q4",
          warnings: []
        }
      },
      { store }
    );
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) throw new Error("expected submitted draft");

    const reviewed = await reviewExtraction(
      {
        jobId: created.data.job.id,
        tenantId: "tenant_1",
        reviewerId: "reviewer_1",
        decision: "approve",
        targetRecord: { moduleId: "invoice", recordId: "inv_1" }
      },
      { store }
    );

    expect(reviewed.ok).toBe(true);
    if (!reviewed.ok) throw new Error("expected reviewed job");
    expect(reviewed.data.job).toMatchObject({
      tenantId: "tenant_1",
      ownerId: "owner_1",
      status: "approved",
      selectedRuntime: "sidecar",
      source: { originalName: "invoice.pdf", pageCount: 2 },
      metadata: { source: "d1-test" }
    });
    expect(reviewed.data.job.draft?.model).toBe("gemma4:12b-q4");
    expect(reviewed.data.job.approvedOutput).toEqual({ vendor: "Acme Supplies", total: 3420.75 });
    expect(reviewed.data.job.review?.targetRecord).toEqual({ moduleId: "invoice", recordId: "inv_1" });
  });

  it("lists jobs by tenant, owner, and status", async () => {
    const first = await createExtractionJob(
      { tenantId: "tenant_1", ownerId: "owner_1", source: { fileId: "file_1", mimeType: "image/png" }, targetType: "receipt" },
      { store }
    );
    const second = await createExtractionJob(
      { tenantId: "tenant_1", ownerId: "owner_2", source: { fileId: "file_2", mimeType: "image/png" }, targetType: "invoice" },
      { store }
    );
    await createExtractionJob(
      { tenantId: "tenant_2", ownerId: "owner_1", source: { fileId: "file_3", mimeType: "image/png" }, targetType: "invoice" },
      { store }
    );
    if (!first.ok || !second.ok) throw new Error("expected seeded jobs");

    await store.updateJob({
      jobId: second.data.job.id,
      tenantId: "tenant_1",
      patch: { status: "needs_review", updatedAt: "2026-01-01T00:00:02.000Z" }
    });

    const ownerJobs = await listExtractionJobs({ tenantId: "tenant_1", ownerId: "owner_1" }, { store });
    expect(ownerJobs.ok).toBe(true);
    if (!ownerJobs.ok) throw new Error("expected owner list");
    expect(ownerJobs.data.jobs.map((job) => job.id)).toEqual([first.data.job.id]);

    const reviewJobs = await listExtractionJobs({ tenantId: "tenant_1", status: "needs_review" }, { store });
    expect(reviewJobs.ok).toBe(true);
    if (!reviewJobs.ok) throw new Error("expected status list");
    expect(reviewJobs.data.jobs.map((job) => job.id)).toEqual([second.data.job.id]);
  });
});
