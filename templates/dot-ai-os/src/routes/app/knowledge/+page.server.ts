import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { authContext, createArticleScoped, listArticlesScoped } from "@microservices-sh/knowledge-base-rag";
import type { KnowledgeArticle } from "@microservices-sh/knowledge-base-rag";
import { recordEvent } from "@microservices-sh/audit-log";
import { requireOrgPermission } from "$lib/server/org-context";

type ArticleFormValues = {
  title: string;
  content: string;
  sourceUrl: string;
};

function articleView(article: KnowledgeArticle) {
  return {
    id: article.id,
    title: article.title,
    excerpt: article.content.length > 180 ? `${article.content.slice(0, 177)}...` : article.content,
    sourceType: article.sourceType,
    sourceUrl: article.sourceUrl,
    wordCount: article.wordCount,
    updatedLabel: article.updatedAt.slice(0, 10)
  };
}

function articleFormValues(form: FormData): ArticleFormValues {
  return {
    title: String(form.get("title") ?? "").trim(),
    content: String(form.get("content") ?? "").trim(),
    sourceUrl: String(form.get("sourceUrl") ?? "").trim()
  };
}

function formError(status: number, error: string, values: ArticleFormValues) {
  return fail(status, { error, values });
}

function validOptionalUrl(value: string): boolean {
  if (!value) return true;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export const load: PageServerLoad = async ({ locals, cookies, parent }) => {
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);
  const ctx = authContext({ orgId: activeOrgId, actorId: locals.user.id, roles: permissions });
  const result = await listArticlesScoped(ctx, { status: "active", limit: 24 }, { store: locals.knowledgeStore });
  const canManage = permissions.includes("*") || permissions.includes("member.manage");

  return {
    canManage,
    articles: (result.data?.articles ?? []).map(articleView)
  };
};

export const actions: Actions = {
  create: async ({ request, locals, cookies, parent }) => {
    const { activeOrgId } = await parent();
    if (!activeOrgId || !locals.user) return fail(403, { error: "Not signed in to a workspace." });

    const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "member.manage", locals.rbacStore);
    const ctx = authContext({ orgId: activeOrgId, actorId: locals.user.id, roles: permissions });
    const form = await request.formData();
    const values = articleFormValues(form);

    if (values.title.length < 2 || values.content.length < 20) {
      return formError(400, "Add a title and at least 20 characters of reusable knowledge.", values);
    }

    if (!validOptionalUrl(values.sourceUrl)) {
      return formError(400, "Enter a valid source URL or leave it blank.", values);
    }

    const result = await createArticleScoped(
      ctx,
      {
        title: values.title,
        content: values.content,
        sourceType: values.sourceUrl ? "web_scan" : "manual",
        sourceUrl: values.sourceUrl || null
      },
      { store: locals.knowledgeStore }
    );
    if (!result.ok || !result.data) {
      return formError(result.status ?? 400, "Could not save the knowledge article.", values);
    }

    await recordEvent(
      {
        eventName: "knowledge-base-rag.article_created",
        actorId: locals.user.id,
        entityType: "knowledge_article",
        entityId: result.data.article.id,
        source: "app/knowledge",
        payload: { title: values.title, sourceType: result.data.article.sourceType }
      },
      { auditStore: locals.auditStore }
    );

    return { ok: true, created: true };
  }
};
