import type { EventEnvelope } from "../event-envelope";

export interface QueueMessage {
  body: EventEnvelope;
  ack?: () => void;
  retry?: () => void;
}

export interface ConsumerOptions {
  routes: Record<string, string[]>;
  secret: string;
  dispatch: (module: string, envelope: EventEnvelope) => Promise<void> | void;
}

export function handleQueueBatch(
  batch: QueueMessage[],
  opts: ConsumerOptions
): Promise<{ acked: number; rejected: number }>;
