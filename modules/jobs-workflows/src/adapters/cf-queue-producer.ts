import type { QueueProducer } from "../ports";

// Pushes a wake-up message onto a Cloudflare Queue. The consumer should call
// runJob(jobId, ...) for the delivered id; D1 stays the source of truth, so the
// at-least-once nature of Queues is handled by runJob's idempotent execution.
export function createCfQueueProducer(queue: Queue<{ jobId: string }>): QueueProducer {
  return {
    async send(jobId) {
      await queue.send({ jobId });
    }
  };
}
