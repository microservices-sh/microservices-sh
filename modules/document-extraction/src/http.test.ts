import { describe, expect, it } from "vitest";
import { createDocumentExtractionHandler, createMemoryDocumentExtractionStore } from "./index";

function jsonRequest(path: string, body: unknown, method = "POST") {
  return new Request(`https://example.test${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("createDocumentExtractionHandler", () => {
  it("serves the document extraction lifecycle over Fetch-standard routes", async () => {
    const store = createMemoryDocumentExtractionStore();
    const handler = createDocumentExtractionHandler({ store });

    const createdResponse = await handler(jsonRequest("/documents", {
      tenantId: "tenant_1",
      ownerId: "owner_1",
      source: { fileId: "file_1", mimeType: "application/pdf", originalName: "invoice.pdf" },
      targetType: "invoice",
      schemaId: "invoice.v1",
      requestedMode: "hybrid"
    }));
    expect(createdResponse.status).toBe(201);
    const created = await createdResponse.json() as any;
    const jobId = created.data.job.id;

    const listedResponse = await handler(new Request("https://example.test/documents?tenantId=tenant_1&ownerId=owner_1"));
    expect(listedResponse.status).toBe(200);
    const listed = await listedResponse.json() as any;
    expect(listed.data.jobs.map((job: any) => job.id)).toEqual([jobId]);

    const draftResponse = await handler(jsonRequest(`/documents/${jobId}/draft`, {
      tenantId: "tenant_1",
      draft: {
        schemaId: "invoice.v1",
        targetType: "invoice",
        fields: [{ name: "total", value: 99.5, confidence: 0.9 }],
        tables: [],
        confidence: 0.9,
        runtime: "browser-ocr",
        warnings: []
      }
    }));
    expect(draftResponse.status).toBe(200);

    const reviewedResponse = await handler(jsonRequest(`/documents/${jobId}/review`, {
      tenantId: "tenant_1",
      reviewerId: "reviewer_1",
      decision: "approve"
    }));
    expect(reviewedResponse.status).toBe(200);
    const reviewed = await reviewedResponse.json() as any;
    expect(reviewed.data.job).toMatchObject({ status: "approved", approvedOutput: { total: 99.5 } });
  });

  it("maps malformed JSON and unsupported methods to HTTP errors", async () => {
    const handler = createDocumentExtractionHandler({ store: createMemoryDocumentExtractionStore() });

    const badJson = await handler(new Request("https://example.test/documents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not-json"
    }));
    expect(badJson.status).toBe(400);
    expect((await badJson.json() as any).error.code).toBe("DOCUMENT_EXTRACTION_BAD_REQUEST");

    const method = await handler(new Request("https://example.test/documents", { method: "PUT" }));
    expect(method.status).toBe(405);
  });

  it("supports custom base paths", async () => {
    const handler = createDocumentExtractionHandler({ store: createMemoryDocumentExtractionStore() }, { basePath: "/api/documents" });
    const response = await handler(new Request("https://example.test/documents?tenantId=tenant_1"));
    expect(response.status).toBe(404);

    const mounted = await handler(new Request("https://example.test/api/documents?tenantId=tenant_1"));
    expect(mounted.status).toBe(200);
  });
});
