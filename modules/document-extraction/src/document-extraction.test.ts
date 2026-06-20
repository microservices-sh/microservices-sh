import { describe, expect, it } from "vitest";
import {
  createExtractionJob,
  createGemmaExtractionNormalizer,
  createMemoryDocumentExtractionStore,
  getExtractionJob,
  reviewExtraction,
  submitExtractionDraft
} from "./index";

describe("document-extraction lifecycle", () => {
  it("creates a job, accepts a draft, and approves reviewed output", async () => {
    const store = createMemoryDocumentExtractionStore();
    const created = await createExtractionJob(
      {
        tenantId: "tenant_1",
        source: { fileId: "file_1", mimeType: "image/png", originalName: "invoice.png", pageCount: 1 },
        targetType: "invoice",
        schemaId: "invoice.v1",
        requestedMode: "hybrid"
      },
      { store }
    );

    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error("expected created job");
    expect(created.data.job.status).toBe("pending");

    const submitted = await submitExtractionDraft(
      {
        jobId: created.data.job.id,
        tenantId: "tenant_1",
        draft: {
          schemaId: "invoice.v1",
          targetType: "invoice",
          fields: [
            { name: "vendor", value: "Acme Supplies", confidence: 0.98, source: { page: 1, text: "Acme Supplies" } },
            { name: "total", value: 42.5, confidence: 0.93, source: { page: 1, text: "$42.50" } }
          ],
          tables: [],
          rawText: "Acme Supplies\nTotal $42.50",
          confidence: 0.95,
          runtime: "browser-ocr",
          warnings: []
        }
      },
      { store }
    );

    expect(submitted.ok).toBe(true);
    if (!submitted.ok) throw new Error("expected submitted draft");
    expect(submitted.data.job.status).toBe("needs_review");
    expect(submitted.data.job.selectedRuntime).toBe("browser-ocr");

    const reviewed = await reviewExtraction(
      {
        jobId: created.data.job.id,
        tenantId: "tenant_1",
        reviewerId: "user_1",
        decision: "approve",
        targetRecord: { moduleId: "invoice", recordId: "inv_1" }
      },
      { store }
    );

    expect(reviewed.ok).toBe(true);
    if (!reviewed.ok) throw new Error("expected reviewed job");
    expect(reviewed.data.job.status).toBe("approved");
    expect(reviewed.data.job.approvedOutput).toMatchObject({ vendor: "Acme Supplies", total: 42.5 });
    expect(reviewed.data.job.review?.targetRecord).toEqual({ moduleId: "invoice", recordId: "inv_1" });
  });

  it("keeps jobs tenant scoped", async () => {
    const store = createMemoryDocumentExtractionStore();
    const created = await createExtractionJob(
      { tenantId: "tenant_a", source: { fileId: "file_1", mimeType: "application/pdf" } },
      { store }
    );
    if (!created.ok) throw new Error("expected created job");

    const result = await getExtractionJob({ tenantId: "tenant_b", jobId: created.data.job.id }, { store });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected not found");
    expect(result.status).toBe(404);
  });
});

describe("Gemma extraction normalizer", () => {
  it("normalizes model JSON into an extraction draft", async () => {
    const normalizer = createGemmaExtractionNormalizer({
      model: "gemma4:e2b",
      client: {
        async complete() {
          return {
            model: "gemma4:e2b",
            text: JSON.stringify({
              fields: [{ name: "vendor", value: "Acme", confidence: 0.9 }],
              tables: [],
              confidence: 0.9,
              warnings: []
            })
          };
        }
      }
    });

    const draft = await normalizer.normalize({
      tenantId: "tenant_1",
      schemaId: "invoice.v1",
      targetType: "invoice",
      runtime: "ai-gateway",
      rawText: "Vendor: Acme"
    });

    expect(draft.model).toBe("gemma4:e2b");
    expect(draft.fields[0]).toMatchObject({ name: "vendor", value: "Acme" });
  });

  it("falls back to raw text when model output is not valid JSON", async () => {
    const normalizer = createGemmaExtractionNormalizer({
      client: {
        async complete() {
          return { text: "not json" };
        }
      }
    });

    const draft = await normalizer.normalize({
      tenantId: "tenant_1",
      schemaId: "custom.v1",
      targetType: "custom",
      runtime: "ai-gateway",
      rawText: "Unreadable scan text"
    });

    expect(draft.fields[0]).toMatchObject({ name: "rawText", needsReview: true });
    expect(draft.warnings[0]).toContain("Gemma normalizer parse failed");
  });
});
