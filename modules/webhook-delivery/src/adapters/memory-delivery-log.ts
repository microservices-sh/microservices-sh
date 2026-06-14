import type { DeliveryLogStore } from "../ports";
import type { DeliveryAttempt } from "../types";

export function createMemoryDeliveryLog(): DeliveryLogStore {
  const attempts: DeliveryAttempt[] = [];

  return {
    async append(attempt) {
      attempts.push({ ...attempt });
    },

    async list(filter) {
      let rows = [...attempts];
      if (filter.endpointId) rows = rows.filter((attempt) => attempt.endpointId === filter.endpointId);
      if (filter.status) rows = rows.filter((attempt) => attempt.status === filter.status);
      rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return rows.slice(0, filter.limit ?? 100).map((attempt) => ({ ...attempt }));
    }
  };
}
