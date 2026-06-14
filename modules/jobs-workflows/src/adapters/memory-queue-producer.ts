import type { QueueProducer } from "../ports";

// Records sent job ids for assertions in tests. No real I/O.
export function createMemoryQueueProducer(): QueueProducer & { sent: string[] } {
  const sent: string[] = [];
  return {
    sent,
    async send(jobId) {
      sent.push(jobId);
    }
  };
}
