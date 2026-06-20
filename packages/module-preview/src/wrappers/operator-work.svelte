<script lang="ts">
  // Interactive wrapper for the operator-work module. Auto-discovered by the harness
  // (wrappers/<module-id>.svelte). No live backend — the demo mirrors the real use
  // cases: updateOperatorTaskStatus (task.status_changed), upsertFocusBlock
  // (focus_block.upserted), saveDailyReview (daily_review.saved). Tasks carry a
  // source so human (manual/inbox) and agent work share one board.
  import Preview from "@microservices-sh/operator-work/preview";

  let { module: m }: { module: any } = $props();

  let tasks = $state<any[]>([
    { id: "t1", title: "Ship the booking preview", detail: "Rich Preview.svelte + wire export", status: "done", priority: "High", category: "Product", dueLabel: "today", source: "manual", subtasks: [{ id: "s1", done: true }, { id: "s2", done: true }] },
    { id: "t2", title: "Draft Q3 pilot outreach", detail: "10 agencies, personalized", status: "in-progress", priority: "High", category: "GTM", dueLabel: "today", source: "agent", subtasks: [{ id: "s3", done: true }, { id: "s4", done: false }, { id: "s5", done: false }] },
    { id: "t3", title: "Review billing migration", detail: "plan_version_id backfill", status: "in-progress", priority: "Medium", category: "Eng", dueLabel: "tomorrow", source: "calendar", subtasks: [] },
    { id: "t4", title: "Reply to partner about webhook", detail: "HMAC secret rotation question", status: "todo", priority: "Medium", category: "Comms", dueLabel: "today", source: "inbox", subtasks: [] },
    { id: "t5", title: "Outline demo video v2", detail: "9-scene story", status: "todo", priority: "Low", category: "Marketing", dueLabel: "this week", source: "agent", subtasks: [] }
  ]);

  const focusBlocks = [
    { id: "f1", timeRange: "09:00–11:00", title: "Module previews — deep work", energy: "Deep", note: "no meetings" },
    { id: "f2", timeRange: "11:30–12:00", title: "PR review", energy: "Review", note: "" },
    { id: "f3", timeRange: "14:00–14:45", title: "Pilot replies", energy: "Comms", note: "inbox zero" }
  ];

  let review = $state<any>({ shipped: "", openLoops: "", agentHandoffs: "", tomorrowFirstMove: "", status: "draft" });

  function ontaskstatus(id: string, status: string) {
    // updateOperatorTaskStatus → operator-work.task.status_changed (+ task.upserted)
    tasks = tasks.map((t) => (t.id === id ? { ...t, status } : t));
  }
  function onsavereview(input: { shipped: string; openLoops: string; agentHandoffs: string; tomorrowFirstMove: string }) {
    // saveDailyReview → operator-work.daily_review.saved
    review = { ...input, status: "saved" };
  }
</script>

<Preview {tasks} {focusBlocks} {review} {ontaskstatus} {onsavereview} />
