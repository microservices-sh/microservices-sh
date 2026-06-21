export interface ProjectProgressHooks {
  beforeProjectCreate?: (input: unknown) => Promise<unknown> | unknown;
  beforeProgressLogCreate?: (input: unknown) => Promise<unknown> | unknown;
  afterProgressLogCreated?: (snapshot: unknown) => Promise<void> | void;
  afterCommentCreated?: (comment: unknown) => Promise<void> | void;
}

export const defaultProjectProgressHooks: Required<ProjectProgressHooks> = {
  beforeProjectCreate(input) {
    return input;
  },
  beforeProgressLogCreate(input) {
    return input;
  },
  afterProgressLogCreated() {
    return undefined;
  },
  afterCommentCreated() {
    return undefined;
  }
};
