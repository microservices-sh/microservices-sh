# Idempotency Reference UI

Admin: idempotency record lookup, replay inspection, stale in-progress records, and retention/prune diagnostics.

Visitor: not applicable. Idempotency is internal retry-safety infrastructure.

Agentic: record lookup is safe first. Require approval before claiming, completing, failing, or pruning records.
