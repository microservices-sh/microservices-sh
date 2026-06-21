export interface UrlShortenerHooks {
  beforeUrlShortenerCreate?: (input: unknown) => Promise<unknown> | unknown;
  afterUrlShortenerUpdated?: (record: unknown) => Promise<void> | void;
}

export const defaultUrlShortenerHooks: Required<UrlShortenerHooks> = {
  beforeUrlShortenerCreate(input) {
    return input;
  },
  afterUrlShortenerUpdated() {
    return undefined;
  }
};
