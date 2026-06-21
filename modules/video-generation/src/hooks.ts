export interface VideoGenerationHooks {
  beforeVideoJobCreate?: (input: unknown) => Promise<unknown> | unknown;
  beforeVideoJobSubmit?: (job: unknown) => Promise<unknown> | unknown;
  afterVideoJobCompleted?: (job: unknown) => Promise<void> | void;
  afterVideoOutputAttached?: (output: unknown) => Promise<void> | void;
}

export const defaultVideoGenerationHooks: Required<VideoGenerationHooks> = {
  beforeVideoJobCreate(input) {
    return input;
  },
  beforeVideoJobSubmit(job) {
    return job;
  },
  afterVideoJobCompleted() {
    return undefined;
  },
  afterVideoOutputAttached() {
    return undefined;
  }
};
