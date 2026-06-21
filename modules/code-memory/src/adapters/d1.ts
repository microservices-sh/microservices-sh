import type { CodeMemoryStore } from "../ports";
import type { CapsuleApprovalStatus, CapsuleReuseMode, CapsuleVisibility, CodeMemoryEvent, LogicCapsule, RepoVisibility, SearchLogicCapsulesInput, SourceScanStatus, SourceVersion, TrustedSource, TrustedSourceProvider } from "../types";

const SOURCE_COLS = "id, tenant_id, owner_user_id, provider, repo_url, repo_owner, repo_name, repo_visibility, default_branch, allowed_paths_json, installation_id, scan_status, created_at, updated_at";
const VERSION_COLS = "id, tenant_id, source_id, ref, commit_sha, tree_checksum, scan_status, scan_summary_json, created_at";
const CAPSULE_COLS = "id, tenant_id, source_id, source_version_id, slug, name, purpose, reuse_mode, source_path, source_files_json, test_files_json, dependencies_json, required_env_json, inputs_json, outputs_json, usage_notes, constraints_json, do_not_use_for_json, checksum, approval_status, visibility, provenance_json, created_at, updated_at";
const EVENT_COLS = "id, tenant_id, actor_user_id, action, target_type, target_id, metadata_json, created_at";

function nullable(value: unknown): string | null {
  return value == null ? null : String(value);
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || !value.trim()) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toSource(row: Record<string, unknown>): TrustedSource {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    ownerUserId: nullable(row.owner_user_id),
    provider: String(row.provider) as TrustedSourceProvider,
    repoUrl: String(row.repo_url),
    repoOwner: String(row.repo_owner),
    repoName: String(row.repo_name),
    repoVisibility: String(row.repo_visibility ?? "unknown") as RepoVisibility,
    defaultBranch: nullable(row.default_branch),
    allowedPaths: parseJson<string[]>(row.allowed_paths_json, []),
    installationId: nullable(row.installation_id),
    scanStatus: String(row.scan_status ?? "not_scanned") as SourceScanStatus,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function toVersion(row: Record<string, unknown>): SourceVersion {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    sourceId: String(row.source_id),
    ref: String(row.ref),
    commitSha: nullable(row.commit_sha),
    treeChecksum: nullable(row.tree_checksum),
    scanStatus: String(row.scan_status ?? "pending") as SourceScanStatus,
    scanSummary: parseJson<Record<string, unknown>>(row.scan_summary_json, {}),
    createdAt: String(row.created_at)
  };
}

function toCapsule(row: Record<string, unknown>): LogicCapsule {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    sourceId: String(row.source_id),
    sourceVersionId: nullable(row.source_version_id),
    slug: String(row.slug),
    name: String(row.name),
    purpose: String(row.purpose),
    reuseMode: String(row.reuse_mode ?? "adapt") as CapsuleReuseMode,
    sourcePath: nullable(row.source_path),
    files: parseJson<string[]>(row.source_files_json, []),
    tests: parseJson<string[]>(row.test_files_json, []),
    dependencies: parseJson<string[]>(row.dependencies_json, []),
    requiredEnv: parseJson<string[]>(row.required_env_json, []),
    inputs: parseJson<string[]>(row.inputs_json, []),
    outputs: parseJson<string[]>(row.outputs_json, []),
    usageNotes: nullable(row.usage_notes),
    constraints: parseJson<string[]>(row.constraints_json, []),
    doNotUseFor: parseJson<string[]>(row.do_not_use_for_json, []),
    checksum: nullable(row.checksum),
    approvalStatus: String(row.approval_status ?? "candidate") as CapsuleApprovalStatus,
    visibility: String(row.visibility ?? "workspace_private") as CapsuleVisibility,
    provenance: parseJson(row.provenance_json, {}),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function createD1CodeMemoryStore(db: D1Database): CodeMemoryStore {
  return {
    async getSource(tenantId, sourceId) {
      const row = await db.prepare(`SELECT ${SOURCE_COLS} FROM code_memory_sources WHERE tenant_id = ? AND id = ?`).bind(tenantId, sourceId).first<Record<string, unknown>>();
      return row ? toSource(row) : null;
    },
    async insertSource(source) {
      await db.prepare(`INSERT INTO code_memory_sources (${SOURCE_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(source.id, source.tenantId, source.ownerUserId, source.provider, source.repoUrl, source.repoOwner, source.repoName, source.repoVisibility, source.defaultBranch, JSON.stringify(source.allowedPaths), source.installationId, source.scanStatus, source.createdAt, source.updatedAt)
        .run();
    },
    async updateSource(source) {
      await db.prepare("UPDATE code_memory_sources SET owner_user_id = ?, repo_visibility = ?, default_branch = ?, allowed_paths_json = ?, installation_id = ?, scan_status = ?, updated_at = ? WHERE tenant_id = ? AND id = ?")
        .bind(source.ownerUserId, source.repoVisibility, source.defaultBranch, JSON.stringify(source.allowedPaths), source.installationId, source.scanStatus, source.updatedAt, source.tenantId, source.id)
        .run();
    },
    async listSources(tenantId, limit = 50) {
      const result = await db.prepare(`SELECT ${SOURCE_COLS} FROM code_memory_sources WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?`).bind(tenantId, limit).all<Record<string, unknown>>();
      return (result.results ?? []).map(toSource);
    },
    async insertSourceVersion(version) {
      await db.prepare(`INSERT INTO code_memory_source_versions (${VERSION_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(version.id, version.tenantId, version.sourceId, version.ref, version.commitSha, version.treeChecksum, version.scanStatus, JSON.stringify(version.scanSummary), version.createdAt)
        .run();
    },
    async getLatestSourceVersion(tenantId, sourceId) {
      const row = await db.prepare(`SELECT ${VERSION_COLS} FROM code_memory_source_versions WHERE tenant_id = ? AND source_id = ? ORDER BY created_at DESC LIMIT 1`).bind(tenantId, sourceId).first<Record<string, unknown>>();
      return row ? toVersion(row) : null;
    },
    async updateSourceScanStatus(tenantId, sourceId, status, updatedAt) {
      const result = await db.prepare("UPDATE code_memory_sources SET scan_status = ?, updated_at = ? WHERE tenant_id = ? AND id = ?")
        .bind(status, updatedAt, tenantId, sourceId)
        .run();
      if (Number(result.meta?.changes ?? 0) === 0) return null;
      return this.getSource(tenantId, sourceId);
    },
    async insertCapsule(capsule) {
      await db.prepare(`INSERT INTO code_memory_capsules (${CAPSULE_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(capsule.id, capsule.tenantId, capsule.sourceId, capsule.sourceVersionId, capsule.slug, capsule.name, capsule.purpose, capsule.reuseMode, capsule.sourcePath, JSON.stringify(capsule.files), JSON.stringify(capsule.tests), JSON.stringify(capsule.dependencies), JSON.stringify(capsule.requiredEnv), JSON.stringify(capsule.inputs), JSON.stringify(capsule.outputs), capsule.usageNotes, JSON.stringify(capsule.constraints), JSON.stringify(capsule.doNotUseFor), capsule.checksum, capsule.approvalStatus, capsule.visibility, JSON.stringify(capsule.provenance), capsule.createdAt, capsule.updatedAt)
        .run();
    },
    async updateCapsule(capsule) {
      await db.prepare("UPDATE code_memory_capsules SET name = ?, purpose = ?, reuse_mode = ?, source_path = ?, source_files_json = ?, test_files_json = ?, dependencies_json = ?, required_env_json = ?, inputs_json = ?, outputs_json = ?, usage_notes = ?, constraints_json = ?, do_not_use_for_json = ?, checksum = ?, approval_status = ?, visibility = ?, provenance_json = ?, updated_at = ? WHERE tenant_id = ? AND id = ?")
        .bind(capsule.name, capsule.purpose, capsule.reuseMode, capsule.sourcePath, JSON.stringify(capsule.files), JSON.stringify(capsule.tests), JSON.stringify(capsule.dependencies), JSON.stringify(capsule.requiredEnv), JSON.stringify(capsule.inputs), JSON.stringify(capsule.outputs), capsule.usageNotes, JSON.stringify(capsule.constraints), JSON.stringify(capsule.doNotUseFor), capsule.checksum, capsule.approvalStatus, capsule.visibility, JSON.stringify(capsule.provenance), capsule.updatedAt, capsule.tenantId, capsule.id)
        .run();
    },
    async getCapsuleByIdOrSlug(tenantId, idOrSlug) {
      const row = await db.prepare(`SELECT ${CAPSULE_COLS} FROM code_memory_capsules WHERE tenant_id = ? AND (id = ? OR slug = ?)`).bind(tenantId, idOrSlug, idOrSlug).first<Record<string, unknown>>();
      return row ? toCapsule(row) : null;
    },
    async searchCapsules(tenantId, input: SearchLogicCapsulesInput) {
      const status = input.approvalStatus ?? "approved";
      const query = input.query?.trim();
      const limit = input.limit ?? 25;
      const clauses = ["tenant_id = ?"];
      const params: Array<string | number> = [tenantId];
      if (status !== "any") {
        clauses.push("approval_status = ?");
        params.push(status);
      }
      if (query) {
        clauses.push("(slug LIKE ? OR name LIKE ? OR purpose LIKE ? OR source_path LIKE ? OR source_files_json LIKE ? OR test_files_json LIKE ? OR constraints_json LIKE ?)");
        const pattern = `%${query}%`;
        params.push(pattern, pattern, pattern, pattern, pattern, pattern, pattern);
      }
      params.push(limit);
      const result = await db.prepare(`SELECT ${CAPSULE_COLS} FROM code_memory_capsules WHERE ${clauses.join(" AND ")} ORDER BY updated_at DESC LIMIT ?`).bind(...params).all<Record<string, unknown>>();
      return (result.results ?? []).map(toCapsule);
    },
    async insertEvent(event: CodeMemoryEvent) {
      await db.prepare(`INSERT INTO code_memory_events (${EVENT_COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(event.id, event.tenantId, event.actorUserId, event.action, event.targetType, event.targetId, JSON.stringify(event.metadata), event.createdAt)
        .run();
    }
  };
}
