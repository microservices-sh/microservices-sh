<script lang="ts">
  // Interactive wrapper for the jobs-workflows module. Auto-discovered by the
  // harness (wrappers/<module-id>.svelte). No live backend — the demo mirrors the
  // real use cases: enqueueJob (idempotent by key → job.enqueued), runDueJobs /
  // runJob (job.succeeded, or job.retried with backoff, or job.dead). Retry delays
  // come from the module's real computeBackoffMs. Each attempt appends a JobRun.
  import Preview from "@microservices-sh/jobs-workflows/preview";
  import { computeBackoffMs } from "@microservices-sh/jobs-workflows/backoff";

  let { module: m }: { module: any } = $props();

  // Each enqueue type has a scripted handler outcome so the lifecycle is legible:
  //  - email.send: succeeds first try
  //  - report.generate: fails twice (transient), then succeeds
  //  - webhook.push: always fails → dead-letters after maxAttempts
  //  - daily-digest: carries a fixed idempotency key → second enqueue dedupes
  const HANDLERS: Record<string, (attempt: number) => { ok: boolean; error?: string }> = {
    "email.send": () => ({ ok: true }),
    "report.generate": (a) => (a < 3 ? { ok: false, error: "upstream 503" } : { ok: true }),
    "webhook.push": () => ({ ok: false, error: "connection refused" }),
    "daily-digest": () => ({ ok: true })
  };
  const enqueueTypes = [
    { type: "email.send", label: "email.send" },
    { type: "report.generate", label: "report.generate (flaky)" },
    { type: "webhook.push", label: "webhook.push (fails)" },
    { type: "daily-digest", label: "daily-digest (idempotent)" }
  ];
  const KEYED: Record<string, string> = { "daily-digest": "digest-2026-06-20" };

  let jSeq = 1;
  let rSeq = 1;
  let jobs = $state<any[]>([]);
  let runs = $state<any[]>([]);
  let lastEnqueue = $state<any>(null);
  const schedules = [
    { id: "sch_1", type: "daily-digest", intervalMs: 86_400_000, nextRunAt: new Date(Date.now() + 6 * 3600_000).toISOString() },
    { id: "sch_2", type: "metrics.rollup", intervalMs: 3_600_000, nextRunAt: new Date(Date.now() + 12 * 60_000).toISOString() }
  ];

  function onenqueue(type: string) {
    const key = KEYED[type] ?? null;
    if (key) {
      const existing = jobs.find((j) => j.idempotencyKey === key && j.status !== "dead");
      if (existing) { lastEnqueue = { type, deduped: true }; return; } // enqueue is idempotent
    }
    jobs = [...jobs, { id: `job_${jSeq++}`, type, status: "pending", attempts: 0, maxAttempts: type === "webhook.push" ? 3 : 5, runAt: new Date().toISOString(), lastError: null, idempotencyKey: key }];
    lastEnqueue = { type, deduped: false };
  }

  function onrundue() {
    const now = Date.now();
    const next = jobs.map((j) => ({ ...j }));
    for (const j of next) {
      if (j.status !== "pending" || new Date(j.runAt).getTime() > now) continue;
      const attempt = j.attempts + 1;
      const outcome = (HANDLERS[j.type] ?? (() => ({ ok: true })))(attempt);
      j.attempts = attempt;
      runs = [{ id: `run_${rSeq++}`, jobType: j.type, attempt, status: outcome.ok ? "succeeded" : "failed", error: outcome.ok ? null : outcome.error ?? "error", finishedAt: new Date().toISOString() }, ...runs];
      if (outcome.ok) {
        j.status = "succeeded"; j.lastError = null; // job.succeeded
      } else if (attempt >= j.maxAttempts) {
        j.status = "dead"; j.lastError = `dead-lettered after ${attempt}: ${outcome.error}`; // job.dead
      } else {
        // job.retried — requeue with real exponential backoff
        const backoff = computeBackoffMs(attempt);
        j.status = "pending"; j.lastError = `${outcome.error} · retry in ${Math.round(backoff / 1000)}s`;
        j.runAt = new Date(now + backoff).toISOString();
      }
    }
    jobs = next;
  }
</script>

<Preview {enqueueTypes} {jobs} {runs} {schedules} {lastEnqueue} {onenqueue} {onrundue} />
