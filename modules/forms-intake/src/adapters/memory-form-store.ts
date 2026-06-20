import type { FormStore } from "../ports";
import type { Form, FormSubmission } from "../types";

export function createMemoryFormStore(): FormStore {
  const forms = new Map<string, Form>();
  const submissions: FormSubmission[] = [];
  const submissionKeys = new Set<string>();

  return {
    async insertForm(form) {
      forms.set(form.id, structuredClone(form));
    },
    async getForm(id, tenantId) {
      const form = forms.get(id);
      if (!form || form.tenantId !== tenantId) return null;
      return structuredClone(form);
    },
    async updateForm(form) {
      const existing = forms.get(form.id);
      if (existing && existing.tenantId === form.tenantId) forms.set(form.id, structuredClone(form));
    },
    async listForms(filter) {
      return [...forms.values()]
        .filter((f) => f.tenantId === filter.tenantId && (!filter.status || f.status === filter.status))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, filter.limit ?? 100)
        .map((f) => structuredClone(f));
    },

    async insertSubmission(submission) {
      submissions.push(structuredClone(submission));
    },
    async getSubmission(id, tenantId) {
      const found = submissions.find((s) => s.id === id && s.tenantId === tenantId);
      return found ? structuredClone(found) : null;
    },
    async updateSubmission(submission) {
      const idx = submissions.findIndex((s) => s.id === submission.id && s.tenantId === submission.tenantId);
      if (idx !== -1) submissions[idx] = structuredClone(submission);
    },
    async listSubmissions(filter) {
      return submissions
        .filter(
          (s) =>
            s.tenantId === filter.tenantId &&
            s.formId === filter.formId &&
            (!filter.status || s.status === filter.status)
        )
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
        .slice(0, filter.limit ?? 100)
        .map((s) => structuredClone(s));
    },

    async recordSubmissionKey(formId, key) {
      const composite = `${formId}:${key}`;
      if (submissionKeys.has(composite)) return false;
      submissionKeys.add(composite);
      return true;
    }
  };
}
