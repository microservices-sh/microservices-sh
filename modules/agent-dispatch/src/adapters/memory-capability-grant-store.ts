import type { CapabilityGrantStore } from "../ports";
import type { CapabilityGrant } from "../types";

function cloneGrant(grant: CapabilityGrant): CapabilityGrant {
  return {
    ...grant,
    allowedTools: [...grant.allowedTools],
    allowedResources: [...grant.allowedResources]
  };
}

export function createMemoryCapabilityGrantStore(): CapabilityGrantStore {
  const grants = new Map<string, CapabilityGrant>();

  return {
    async insert(grant) {
      grants.set(grant.id, cloneGrant(grant));
    },

    async getForAgentRun(ownerId, agentRunId) {
      for (const grant of grants.values()) {
        if (grant.ownerId === ownerId && grant.agentRunId === agentRunId) return cloneGrant(grant);
      }
      return null;
    },

    async revoke(ownerId, id, revokedAt) {
      const grant = grants.get(id);
      if (!grant || grant.ownerId !== ownerId) return;
      grants.set(id, { ...grant, revokedAt });
    }
  };
}
