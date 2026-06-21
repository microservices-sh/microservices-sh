import type { CodeMemoryEvent, LogicCapsule, SearchLogicCapsulesInput, SourceScanStatus, SourceVersion, TrustedSource } from "../types";

export interface CodeMemoryStore {
  getSource(tenantId: string, sourceId: string): Promise<TrustedSource | null>;
  insertSource(source: TrustedSource): Promise<void>;
  updateSource(source: TrustedSource): Promise<void>;
  listSources(tenantId: string, limit?: number): Promise<TrustedSource[]>;

  insertSourceVersion(version: SourceVersion): Promise<void>;
  getLatestSourceVersion(tenantId: string, sourceId: string): Promise<SourceVersion | null>;
  updateSourceScanStatus(tenantId: string, sourceId: string, status: SourceScanStatus, updatedAt: string): Promise<TrustedSource | null>;

  insertCapsule(capsule: LogicCapsule): Promise<void>;
  updateCapsule(capsule: LogicCapsule): Promise<void>;
  getCapsuleByIdOrSlug(tenantId: string, idOrSlug: string): Promise<LogicCapsule | null>;
  searchCapsules(tenantId: string, input: SearchLogicCapsulesInput): Promise<LogicCapsule[]>;

  insertEvent(event: CodeMemoryEvent): Promise<void>;
}
