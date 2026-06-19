// GraphRAG retrieval for the Research pillar.
// Source of truth = markdown/files (on the per-client Fly volume, optionally
// backed up to R2). graphify runs as a batch over those files and emits a graph
// (nodes/edges/communities, each carrying source_file + source_location). This
// module loads that graph into a GraphStore and retrieves over it at query time.
// No graphify at query time; the store is local SQLite on Fly in production
// (inject a SqliteGraphStore) or the in-memory store below for tests.

export type GraphNode = {
  id: string;
  label: string;
  fileType?: string;
  sourceFile: string;
  sourceLocation: string;
  communityId?: number;
  ownerId: string;
};

export type GraphEdge = {
  sourceId: string;
  targetId: string;
  relation: string;
  weight?: number;
  ownerId: string;
};

export type GraphCommunity = {
  communityId: number;
  label: string;
  cohesion?: number;
  ownerId: string;
};

// A retrieved unit of evidence — always points at a real source file so the
// research synthesizer can cite it (cite-or-refuse).
export type Passage = {
  sourceFile: string;
  sourceLocation: string;
  label: string;
  communityLabel?: string;
  score: number;
};

export interface GraphStore {
  upsertNodes(nodes: GraphNode[]): Promise<void>;
  upsertEdges(edges: GraphEdge[]): Promise<void>;
  upsertCommunities(communities: GraphCommunity[]): Promise<void>;
  // Entry-point match (FTS5 in production; keyword match in memory).
  searchNodes(query: { text: string; ownerId: string; admin?: boolean; limit: number }): Promise<GraphNode[]>;
  neighbors(nodeIds: string[], scope: { ownerId: string; admin?: boolean }): Promise<GraphNode[]>;
  getCommunity(communityId: number, scope: { ownerId: string; admin?: boolean }): Promise<GraphCommunity | null>;
}

export interface Retriever {
  retrieve(query: { text: string; topK: number; ownerId: string; admin?: boolean }): Promise<Passage[]>;
}

export type MemoryGraphStore = GraphStore;

export function createMemoryGraphStore(): MemoryGraphStore {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const communities: GraphCommunity[] = [];
  const visible = (ownerId: string, admin: boolean | undefined, o: { ownerId: string }) => admin || o.ownerId === ownerId;

  return {
    async upsertNodes(input) {
      nodes.push(...input);
    },
    async upsertEdges(input) {
      edges.push(...input);
    },
    async upsertCommunities(input) {
      communities.push(...input);
    },
    async searchNodes({ text, ownerId, admin, limit }) {
      // Keyword entry-point: tokenize the query, match nodes whose label
      // contains any token. (Production uses SQLite FTS5 over labels.)
      const tokens = text.toLowerCase().match(/[a-z0-9]+/g)?.filter((t) => t.length > 2) ?? [];
      if (tokens.length === 0) return [];
      return nodes
        .filter((node) => {
          if (!visible(ownerId, admin, node)) return false;
          const label = node.label.toLowerCase();
          return tokens.some((token) => label.includes(token));
        })
        .slice(0, limit);
    },
    async neighbors(nodeIds, { ownerId, admin }) {
      const ids = new Set(nodeIds);
      const neighborIds = new Set<string>();
      for (const edge of edges) {
        if (!visible(ownerId, admin, edge)) continue;
        if (ids.has(edge.sourceId)) neighborIds.add(edge.targetId);
        if (ids.has(edge.targetId)) neighborIds.add(edge.sourceId);
      }
      return nodes.filter((node) => neighborIds.has(node.id) && visible(ownerId, admin, node));
    },
    async getCommunity(communityId, { ownerId, admin }) {
      return communities.find((community) => community.communityId === communityId && visible(ownerId, admin, community)) ?? null;
    }
  };
}

// ---- graphify output ingestion ----

type GraphifyNode = { id: string; label: string; file_type?: string; source_file: string; source_location: string };
type GraphifyEdge = { source: string; target: string; relation: string; weight?: number };
type GraphifyOutput = {
  semantic: { nodes: GraphifyNode[]; edges: GraphifyEdge[] };
  analysis: { communities: Record<string, string[]>; cohesion?: Record<string, number> };
  labels: Record<string, string>;
};

export async function loadGraphifyOutput(input: GraphifyOutput, deps: { store: GraphStore; ownerId: string }) {
  const ownerId = deps.ownerId;

  // node id -> community id (from analysis.communities membership)
  const communityOf = new Map<string, number>();
  for (const [cid, members] of Object.entries(input.analysis.communities ?? {})) {
    for (const nodeId of members) communityOf.set(nodeId, Number(cid));
  }

  const nodes: GraphNode[] = input.semantic.nodes.map((node) => ({
    id: node.id,
    label: node.label,
    fileType: node.file_type,
    sourceFile: node.source_file,
    sourceLocation: node.source_location,
    communityId: communityOf.get(node.id),
    ownerId
  }));

  const edges: GraphEdge[] = input.semantic.edges.map((edge) => ({
    sourceId: edge.source,
    targetId: edge.target,
    relation: edge.relation,
    weight: edge.weight,
    ownerId
  }));

  const communities: GraphCommunity[] = Object.keys(input.analysis.communities ?? {}).map((cid) => ({
    communityId: Number(cid),
    label: input.labels?.[cid] ?? `Community ${cid}`,
    cohesion: input.analysis.cohesion?.[cid],
    ownerId
  }));

  await deps.store.upsertNodes(nodes);
  await deps.store.upsertEdges(edges);
  await deps.store.upsertCommunities(communities);

  return { ok: true as const, status: 201 as const, data: { nodes: nodes.length, edges: edges.length, communities: communities.length } };
}

// ---- retrieval ----

export function createGraphRetriever(store: GraphStore): Retriever {
  return {
    async retrieve({ text, topK, ownerId, admin }) {
      const scope = { ownerId, admin };
      const entry = await store.searchNodes({ text, ownerId, admin, limit: topK });
      const neighborNodes = await store.neighbors(entry.map((node) => node.id), scope);

      // Dedupe: matched nodes first (higher score), then 1-hop neighbours.
      const seen = new Set<string>();
      const ranked: Array<{ node: GraphNode; score: number }> = [];
      for (const node of entry) {
        if (seen.has(node.id)) continue;
        seen.add(node.id);
        ranked.push({ node, score: 1 });
      }
      for (const node of neighborNodes) {
        if (seen.has(node.id)) continue;
        seen.add(node.id);
        ranked.push({ node, score: 0.5 });
      }

      const communityLabels = new Map<number, string>();
      const passages: Passage[] = [];
      for (const { node, score } of ranked.slice(0, topK)) {
        let communityLabel: string | undefined;
        if (node.communityId !== undefined) {
          if (!communityLabels.has(node.communityId)) {
            const community = await store.getCommunity(node.communityId, scope);
            if (community) communityLabels.set(node.communityId, community.label);
          }
          communityLabel = communityLabels.get(node.communityId);
        }
        passages.push({
          sourceFile: node.sourceFile,
          sourceLocation: node.sourceLocation,
          label: node.label,
          communityLabel,
          score
        });
      }
      return passages;
    }
  };
}
