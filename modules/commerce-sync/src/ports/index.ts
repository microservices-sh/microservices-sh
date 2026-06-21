export interface CommerceSyncRepository {
  getById(id: string): Promise<unknown | null>;
}
