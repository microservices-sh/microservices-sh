// Question → operational-tool planner (Plan 32, P4 first step).
//
// A lightweight, deterministic keyword router: which operations-plane tools (if
// any) does a question imply? Returns registry tool names in a fixed order
// (de-duplicated). No tools ⇒ a pure knowledge question (graph-only). This is
// intentionally a heuristic, not an LLM call — it is cheap, testable, and good
// enough to decide *which planes to consult*; the LLM still does the synthesis.
//
// Care is taken to avoid knowledge-question false positives: "refund policy" must
// not trigger invoice, "onboard a client" must not trigger customer. So triggers
// are specific operational nouns, never soft words like "policy" or "client".

import type { OpsToolName } from "./ops-registry";

const ROUTES: Array<[OpsToolName, string[]]> = [
  ["ops.customer.read", ["customer", "contact info"]],
  ["ops.invoice.read", ["invoice", "owe", "owes", "overdue", "balance", "outstanding", "unpaid", "bill", "billing"]],
  ["ops.booking.read", ["booking", "appointment", "reservation"]],
  ["ops.ticket.read", ["ticket", "support", "complaint"]],
  ["ops.calendar.read", ["calendar", "meeting", "event"]]
];

export function planOpsTools(question: string): OpsToolName[] {
  const q = question.toLowerCase();
  const tools: OpsToolName[] = [];
  for (const [tool, keywords] of ROUTES) {
    if (keywords.some((kw) => q.includes(kw))) tools.push(tool);
  }
  return tools;
}
