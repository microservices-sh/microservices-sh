export interface StorageEntitlementsHooks {
  beforeStorageEntitlementsCreate?: (input: unknown) => Promise<unknown> | unknown;
  afterStorageEntitlementsUpdated?: (record: unknown) => Promise<void> | void;
}

export const defaultStorageEntitlementsHooks: Required<StorageEntitlementsHooks> = {
  beforeStorageEntitlementsCreate(input) {
    return input;
  },
  afterStorageEntitlementsUpdated() {
    return undefined;
  }
};
