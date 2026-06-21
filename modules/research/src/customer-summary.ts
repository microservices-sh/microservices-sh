// Customer 360 (reuses the ops read-back + cite-or-refuse synthesis). Assembles a
// grounded, cited summary of one customer from their LIVE cross-module records —
// profile, invoices, bookings, support tickets — read through the governed
// owner-scoped ops tools. Like operationalBrief, but entity-focused across several
// tools and transient (no persisted brief). Each opsRead is governed/audited;
// tools the actor isn't scoped for are skipped (best-effort), and a customer with
// no records is refused rather than summarized from nothing.

import type { Actor, AuditSink, Passage, Synthesizer } from "./index";
import { type OpsClient, type OpsToolRegistry, opsRead } from "./ops";

const CUSTOMER_360_TOOLS = ["ops.customer.read", "ops.invoice.read", "ops.booking.read", "ops.ticket.read"];

export async function customerSummary(
  input: { customerId: string; tools?: string[] },
  deps: {
    client: OpsClient;
    synthesizer: Synthesizer;
    actor: Actor;
    now: () => number;
    registry?: OpsToolRegistry;
    audit?: AuditSink;
  }
) {
  const tools = input.tools ?? CUSTOMER_360_TOOLS;
  const args = { customerId: input.customerId, id: input.customerId };

  const passages: Passage[] = [];
  for (const tool of tools) {
    try {
      const read = await opsRead(
        { tool, args },
        { client: deps.client, actor: deps.actor, now: deps.now, registry: deps.registry, audit: deps.audit }
      );
      if (read.ok) passages.push(...read.data.passages); // skip refusals (e.g. unscoped) best-effort
    } catch {
      // transport failure / unknown tool — skip it, audit the denial.
      await deps.audit?.record({ action: "ops.read_denied", actorId: deps.actor.id, entityType: "ops_tool", entityId: tool });
    }
  }

  if (passages.length === 0) {
    return { ok: false as const, status: 404 as const, error: { code: "CUSTOMER_NO_RECORDS", message: "No live records for this customer." } };
  }

  const question = `Summarize the current state of customer ${input.customerId}: profile, invoices, bookings, and support tickets.`;
  const { answer, citedSourceFiles } = await deps.synthesizer.synthesize({ question, passages });

  const retrieved = new Set(passages.map((passage) => passage.sourceFile));
  const grounded = citedSourceFiles.length > 0 && citedSourceFiles.every((ref) => retrieved.has(ref));
  if (!grounded) {
    return {
      ok: false as const,
      status: 422 as const,
      error: { code: "CUSTOMER_SUMMARY_UNCITED", message: "Summary must cite only retrieved records.", citedSourceFiles, retrievedSourceFiles: [...retrieved] }
    };
  }

  await deps.audit?.record({ action: "customer.summary", actorId: deps.actor.id, entityType: "customer", entityId: input.customerId });

  return { ok: true as const, status: 200 as const, data: { customerId: input.customerId, summary: answer, citations: citedSourceFiles } };
}
