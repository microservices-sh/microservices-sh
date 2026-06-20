import { createExtractionJob } from "./use-cases/create-extraction-job";
import { getExtractionJob } from "./use-cases/get-extraction-job";
import { listExtractionJobs } from "./use-cases/list-extraction-jobs";
import { reviewExtraction } from "./use-cases/review-extraction";
import { submitExtractionDraft } from "./use-cases/submit-extraction-draft";
import type { DocumentExtractionHooks } from "./hooks";
import type {
  CreateExtractionJobInput,
  GetExtractionJobInput,
  ListExtractionJobsInput,
  ReviewExtractionInput,
  SubmitExtractionDraftInput
} from "./schemas";
import type { DocumentExtractionStore, ModuleResult } from "./types";

export interface DocumentExtractionHttpDeps {
  store: DocumentExtractionStore;
  hooks?: DocumentExtractionHooks;
}

export interface DocumentExtractionHttpOptions {
  basePath?: string;
}

const jsonHeaders = { "content-type": "application/json" };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function resultJson<T>(result: ModuleResult<T>): Response {
  if (result.ok) {
    return json(result.status, { ok: true, data: result.data, warnings: result.warnings ?? [] });
  }
  return json(result.status, { ok: false, error: result.error });
}

function cleanBasePath(value: string): string {
  const trimmed = value.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

function routeParts(pathname: string, basePath: string): string[] | null {
  if (basePath === "/") return pathname.split("/").filter(Boolean).map(decodeURIComponent);
  if (pathname !== basePath && !pathname.startsWith(`${basePath}/`)) return null;
  return pathname.slice(basePath.length).split("/").filter(Boolean).map(decodeURIComponent);
}

async function readJsonObject(request: Request): Promise<Record<string, unknown> | Response> {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json(400, { ok: false, error: { code: "DOCUMENT_EXTRACTION_BAD_REQUEST", message: "Body must be a JSON object." } });
    }
    return body as Record<string, unknown>;
  } catch {
    return json(400, { ok: false, error: { code: "DOCUMENT_EXTRACTION_BAD_REQUEST", message: "Body must be valid JSON." } });
  }
}

function searchInput(url: URL): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  for (const [key, value] of url.searchParams) {
    if (key === "limit") {
      input[key] = Number(value);
    } else {
      input[key] = value;
    }
  }
  return input;
}

export function createDocumentExtractionHandler(
  deps: DocumentExtractionHttpDeps,
  options: DocumentExtractionHttpOptions = {}
) {
  const basePath = cleanBasePath(options.basePath ?? "/documents");

  return async function documentExtractionHandler(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const parts = routeParts(url.pathname, basePath);
    if (!parts) {
      return json(404, { ok: false, error: { code: "DOCUMENT_EXTRACTION_ROUTE_NOT_FOUND", message: "Document extraction route was not found." } });
    }

    if (parts.length === 0) {
      if (request.method === "GET") {
        return resultJson(await listExtractionJobs(searchInput(url) as ListExtractionJobsInput, { store: deps.store }));
      }
      if (request.method === "POST") {
        const body = await readJsonObject(request);
        if (body instanceof Response) return body;
        return resultJson(await createExtractionJob(body as CreateExtractionJobInput, deps));
      }
      return json(405, { ok: false, error: { code: "DOCUMENT_EXTRACTION_METHOD_NOT_ALLOWED", message: "Use GET or POST." } });
    }

    const [jobId, action] = parts;
    if (parts.length === 1 && request.method === "GET") {
      return resultJson(await getExtractionJob({ ...searchInput(url), jobId } as GetExtractionJobInput, { store: deps.store }));
    }

    if (parts.length === 2 && action === "draft" && request.method === "POST") {
      const body = await readJsonObject(request);
      if (body instanceof Response) return body;
      return resultJson(await submitExtractionDraft({ ...body, jobId } as SubmitExtractionDraftInput, deps));
    }

    if (parts.length === 2 && action === "review" && request.method === "POST") {
      const body = await readJsonObject(request);
      if (body instanceof Response) return body;
      return resultJson(await reviewExtraction({ ...body, jobId } as ReviewExtractionInput, deps));
    }

    return json(404, { ok: false, error: { code: "DOCUMENT_EXTRACTION_ROUTE_NOT_FOUND", message: "Document extraction route was not found." } });
  };
}
