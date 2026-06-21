import type { RequestHandler } from "./$types";
import { json } from "@sveltejs/kit";
import { enqueueJob } from "@microservices-sh/jobs-workflows";
import { recordEvent } from "@microservices-sh/audit-log";
import { z } from "zod";

const MAX_IMPORT_BYTES = 512 * 1024;

const desktopDraftImportSchema = z.object({
  localJobId: z.string().min(1).max(160),
  fileName: z.string().min(1).max(260),
  fileHash: z.string().min(8).max(160),
  kind: z.enum(["invoice", "intake", "support"]).or(z.string().min(1).max(80)),
  status: z.literal("approved"),
  confidence: z.number().min(0).max(1),
  pages: z.number().int().nonnegative().max(500).default(0),
  draft: z.record(z.string(), z.unknown()),
  submittedAt: z.string().min(1).max(80).optional()
});

function corsHeaders(request: Request, env: App.Platform["env"] | undefined): HeadersInit {
  const requestOrigin = request.headers.get("origin") ?? "";
  const allowed = (env?.DESKTOP_IMPORT_ALLOWED_ORIGIN ?? requestOrigin) || "*";
  return {
    "access-control-allow-origin": allowed,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "authorization, content-type, ngrok-skip-browser-warning",
    "access-control-max-age": "600",
    vary: "Origin"
  };
}

function rejectCorsIfNeeded(request: Request, env: App.Platform["env"] | undefined): Response | null {
  const allowed = env?.DESKTOP_IMPORT_ALLOWED_ORIGIN;
  const requestOrigin = request.headers.get("origin");
  if (!allowed || allowed === "*" || !requestOrigin || requestOrigin === allowed) return null;
  return json({ ok: false, error: "Origin is not allowed." }, { status: 403, headers: corsHeaders(request, env) });
}

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

async function sha256Bytes(value: string): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(value);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}

async function tokensMatch(actual: string, expected: string): Promise<boolean> {
  const [actualHash, expectedHash] = await Promise.all([sha256Bytes(actual), sha256Bytes(expected)]);
  let diff = actualHash.length ^ expectedHash.length;
  for (let index = 0; index < Math.max(actualHash.length, expectedHash.length); index += 1) {
    diff |= (actualHash[index] ?? 0) ^ (expectedHash[index] ?? 0);
  }
  return diff === 0;
}

async function authorizeDesktopImport(request: Request, env: App.Platform["env"] | undefined): Promise<Response | null> {
  const configured = env?.DESKTOP_IMPORT_TOKEN?.trim();
  if (!configured) {
    return json(
      { ok: false, error: "Desktop import is not configured. Set DESKTOP_IMPORT_TOKEN as a Worker secret." },
      { status: 503, headers: corsHeaders(request, env) }
    );
  }

  const supplied = bearerToken(request);
  if (!supplied || !(await tokensMatch(supplied, configured))) {
    return json({ ok: false, error: "Unauthorized desktop import request." }, { status: 401, headers: corsHeaders(request, env) });
  }

  return null;
}

export const OPTIONS: RequestHandler = async ({ request, platform }) => {
  const corsFailure = rejectCorsIfNeeded(request, platform?.env);
  if (corsFailure) return corsFailure;
  return new Response(null, { status: 204, headers: corsHeaders(request, platform?.env) });
};

export const POST: RequestHandler = async ({ request, platform, locals }) => {
  const corsFailure = rejectCorsIfNeeded(request, platform?.env);
  if (corsFailure) return corsFailure;

  const authFailure = await authorizeDesktopImport(request, platform?.env);
  if (authFailure) return authFailure;

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_IMPORT_BYTES) {
    return json({ ok: false, error: "Desktop import payload is too large." }, { status: 413, headers: corsHeaders(request, platform?.env) });
  }

  const parsed = desktopDraftImportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return json(
      { ok: false, error: "Desktop import payload is invalid.", issues: parsed.error.issues },
      { status: 400, headers: corsHeaders(request, platform?.env) }
    );
  }

  const company = await locals.rbacStore.firstOrganization();
  if (!company) {
    return json(
      { ok: false, error: "Set up the company workspace before importing desktop drafts." },
      { status: 409, headers: corsHeaders(request, platform?.env) }
    );
  }

  const idempotencyKey = `desktop-import:${company.id}:${parsed.data.localJobId}:${parsed.data.fileHash}`;
  const result = await enqueueJob(
    {
      type: "desktop.draft.import",
      idempotencyKey,
      maxAttempts: 5,
      delayMs: 0,
      payload: {
        orgId: company.id,
        localJobId: parsed.data.localJobId,
        fileName: parsed.data.fileName,
        fileHash: parsed.data.fileHash,
        kind: parsed.data.kind,
        pages: parsed.data.pages,
        confidence: parsed.data.confidence,
        draft: parsed.data.draft,
        submittedAt: parsed.data.submittedAt ?? new Date().toISOString()
      }
    },
    { jobStore: locals.jobStore, queue: locals.jobQueue }
  );

  if (!result.ok) {
    return json(
      { ok: false, error: result.error?.message ?? "Could not queue the desktop import." },
      { status: result.status ?? 400, headers: corsHeaders(request, platform?.env) }
    );
  }

  await recordEvent(
    {
      eventName: "desktop.import.submitted",
      actorId: "desktop-import",
      entityType: "desktop_draft",
      entityId: parsed.data.localJobId,
      source: "api/desktop/import",
      payload: {
        orgId: company.id,
        jobId: result.data.id,
        deduped: result.data.deduped,
        fileName: parsed.data.fileName,
        fileHash: parsed.data.fileHash,
        kind: parsed.data.kind,
        confidence: parsed.data.confidence
      }
    },
    { auditStore: locals.auditStore }
  );

  return json(
    {
      ok: true,
      status: result.data.deduped ? "already_queued" : "queued",
      importJobId: result.data.id,
      localJobId: parsed.data.localJobId,
      canonicalStore: "remote-d1"
    },
    { status: result.data.deduped ? 200 : 202, headers: corsHeaders(request, platform?.env) }
  );
};
