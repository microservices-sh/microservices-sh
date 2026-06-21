export interface HtmlRendererHooks {
  beforeHtmlRendererCreate?: (input: unknown) => Promise<unknown> | unknown;
  afterHtmlRendererUpdated?: (record: unknown) => Promise<void> | void;
}

export const defaultHtmlRendererHooks: Required<HtmlRendererHooks> = {
  beforeHtmlRendererCreate(input) {
    return input;
  },
  afterHtmlRendererUpdated() {
    return undefined;
  }
};
