import { err, ok } from "@microservices-sh/connection-contract";
import { defaultConfig } from "../config";
import { knowledgeBaseRagMeta } from "../meta";
import type { KnowledgeStore } from "../ports";
import { listAttachmentsInputSchema } from "../schemas";

export async function listAttachments(
  input: unknown,
  deps: { store: KnowledgeStore; config?: Partial<typeof defaultConfig>; correlationId?: string; now?: () => number }
) {
  const meta = knowledgeBaseRagMeta(deps);
  const parsed = listAttachmentsInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(400, { code: "knowledge-base-rag.INVALID_ATTACHMENT_FILTER", message: "Attachment list input is invalid.", issues: parsed.error.issues }, meta);
  }

  const cfg = { ...defaultConfig, ...deps.config };
  const attachments = await deps.store.listAttachments({
    ...parsed.data,
    limit: Math.min(parsed.data.limit ?? cfg.defaultSearchLimit, cfg.maxSearchLimit)
  });

  return ok(200, { attachments, count: attachments.length }, meta);
}
