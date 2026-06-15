import { verifyEnvelope } from "../event-envelope.js";

// Thin runtime queue consumer (Plan 25 §8, layer-3 async gate). For each queue
// message: verify the HMAC envelope, look up the generated routing table, and
// dispatch the (verified) envelope to each consumer module. Tampered/unsigned
// envelopes are rejected (and retried if the queue message supports it).
//
//   batch:   array of { body: EventEnvelope, ack?(), retry?() }  (CF queue shape)
//   opts:    { routes: { [eventName]: string[] }, secret, dispatch(module, envelope) }
//
// Returns { acked, rejected }.
export async function handleQueueBatch(batch, { routes, secret, dispatch }) {
  let acked = 0;
  let rejected = 0;

  for (const msg of batch) {
    const envelope = msg.body;
    const valid = await verifyEnvelope(envelope, secret);
    if (!valid) {
      rejected += 1;
      msg.retry?.();
      continue;
    }

    const consumers = routes[envelope.eventName] ?? [];
    for (const module of consumers) {
      await dispatch(module, envelope);
    }
    acked += 1;
    msg.ack?.();
  }

  return { acked, rejected };
}
