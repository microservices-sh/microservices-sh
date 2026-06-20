import type { CreateExtractionJobInput } from "./schemas";
import type { DocumentExtractionJob, ExtractionDraft } from "./types";

export interface DocumentExtractionHooks {
  beforeExtractionJobCreate?: (input: CreateExtractionJobInput) => Promise<CreateExtractionJobInput | null> | CreateExtractionJobInput | null;
  beforeExtractionDraftSubmit?: (input: { job: DocumentExtractionJob; draft: ExtractionDraft }) => Promise<ExtractionDraft | null> | ExtractionDraft | null;
  afterExtractionReviewed?: (job: DocumentExtractionJob) => Promise<void> | void;
}

export const defaultDocumentExtractionHooks: Required<DocumentExtractionHooks> = {
  beforeExtractionJobCreate(input) {
    return input;
  },
  beforeExtractionDraftSubmit({ draft }) {
    return draft;
  },
  afterExtractionReviewed() {
    return undefined;
  }
};
