import type { CodeMemoryStore } from "../ports";
import type { CodeMemoryEvent, LogicCapsule, SearchLogicCapsulesInput, SourceScanStatus, SourceVersion, TrustedSource } from "../types";

export interface CodeMemoryMemoryStoreState {
  sources?: TrustedSource[];
  sourceVersions?: SourceVersion[];
  capsules?: LogicCapsule[];
  events?: CodeMemoryEvent[];
}

function copy<T>(value: T): T {
  return structuredClone(value);
}

function ownerKey(tenantId: string, id: string): string {
  return `${tenantId}:${id}`;
}

function matchesQuery(capsule: LogicCapsule, query: string): boolean {
  const haystack = [
    capsule.slug,
    capsule.name,
    capsule.purpose,
    capsule.sourcePath,
    ...capsule.files,
    ...capsule.tests,
    ...capsule.dependencies,
    ...capsule.requiredEnv,
    ...capsule.constraints,
    ...capsule.doNotUseFor
  ].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export function createCodeMemoryMemoryStore(initialState: CodeMemoryMemoryStoreState = {}): CodeMemoryStore {
  const sources = new Map<string, TrustedSource>();
  const versions = new Map<string, SourceVersion>();
  const capsules = new Map<string, LogicCapsule>();
  const events = new Map<string, CodeMemoryEvent>();

  for (const source of initialState.sources ?? []) sources.set(ownerKey(source.tenantId, source.id), copy(source));
  for (const version of initialState.sourceVersions ?? []) versions.set(ownerKey(version.tenantId, version.id), copy(version));
  for (const capsule of initialState.capsules ?? []) capsules.set(ownerKey(capsule.tenantId, capsule.id), copy(capsule));
  for (const event of initialState.events ?? []) events.set(ownerKey(event.tenantId, event.id), copy(event));

  return {
    async getSource(tenantId, sourceId) {
      const source = sources.get(ownerKey(tenantId, sourceId));
      return source ? copy(source) : null;
    },
    async insertSource(source) {
      sources.set(ownerKey(source.tenantId, source.id), copy(source));
    },
    async updateSource(source) {
      sources.set(ownerKey(source.tenantId, source.id), copy(source));
    },
    async listSources(tenantId, limit = 50) {
      return [...sources.values()]
        .filter((source) => source.tenantId === tenantId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit)
        .map(copy);
    },
    async insertSourceVersion(version) {
      versions.set(ownerKey(version.tenantId, version.id), copy(version));
    },
    async getLatestSourceVersion(tenantId, sourceId) {
      const latest = [...versions.values()]
        .filter((version) => version.tenantId === tenantId && version.sourceId === sourceId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      return latest ? copy(latest) : null;
    },
    async updateSourceScanStatus(tenantId, sourceId, status, updatedAt) {
      const source = sources.get(ownerKey(tenantId, sourceId));
      if (!source) return null;
      const updated = { ...source, scanStatus: status, updatedAt };
      sources.set(ownerKey(tenantId, sourceId), copy(updated));
      return copy(updated);
    },
    async insertCapsule(capsule) {
      capsules.set(ownerKey(capsule.tenantId, capsule.id), copy(capsule));
    },
    async updateCapsule(capsule) {
      capsules.set(ownerKey(capsule.tenantId, capsule.id), copy(capsule));
    },
    async getCapsuleByIdOrSlug(tenantId, idOrSlug) {
      const exact = capsules.get(ownerKey(tenantId, idOrSlug));
      if (exact) return copy(exact);
      const capsule = [...capsules.values()].find((item) => item.tenantId === tenantId && item.slug === idOrSlug);
      return capsule ? copy(capsule) : null;
    },
    async searchCapsules(tenantId, input: SearchLogicCapsulesInput) {
      const status = input.approvalStatus ?? "approved";
      const query = input.query?.trim();
      const limit = input.limit ?? 25;
      return [...capsules.values()]
        .filter((capsule) => capsule.tenantId === tenantId)
        .filter((capsule) => status === "any" || capsule.approvalStatus === status)
        .filter((capsule) => !query || matchesQuery(capsule, query))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, limit)
        .map(copy);
    },
    async insertEvent(event) {
      events.set(ownerKey(event.tenantId, event.id), copy(event));
    }
  };
}
