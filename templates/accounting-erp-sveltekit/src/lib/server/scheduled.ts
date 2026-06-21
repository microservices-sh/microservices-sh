import { recordEvent } from "@microservices-sh/audit-log";
import { createCfQueueProducer, dueScheduledJobs, runDueJobs } from "@microservices-sh/jobs-workflows";
import { resolveStores } from "./stores";
import { createRecurringInvoiceJobHandlers } from "./recurring-invoice-jobs";

type Env = NonNullable<App.Platform["env"]>;

export interface ScheduledEventLike {
  cron?: string;
  scheduledTime?: number;
}

function scheduledNow(event: ScheduledEventLike): () => number {
  return () => (typeof event.scheduledTime === "number" ? event.scheduledTime : Date.now());
}

export async function runAccountingScheduled(event: ScheduledEventLike, env: Env | undefined) {
  const stores = resolveStores(env?.DB, env?.MEDIA_BUCKET);
  const now = scheduledNow(event);
  const correlationId = `cron:${event.cron ?? "manual"}:${now()}`;
  const queue = env?.JOB_QUEUE ? createCfQueueProducer(env.JOB_QUEUE) : undefined;

  const scheduled = await dueScheduledJobs({
    scheduleStore: stores.scheduleStore,
    jobStore: stores.jobStore,
    queue,
    now,
    correlationId
  });

  const ran = await runDueJobs(
    createRecurringInvoiceJobHandlers({
      invoiceStore: stores.invoiceStore,
      recurringInvoiceStore: stores.recurringInvoiceStore,
      allocator: stores.numberAllocator,
      accountingCoreStore: stores.accountingCoreStore,
      accountsReceivableService: stores.accountsReceivableService,
      actor: { id: "cloudflare:scheduled", permissions: ["member.manage"] },
      now
    }),
    {
      jobStore: stores.jobStore,
      runStore: stores.jobRunStore,
      now,
      correlationId
    }
  );

  await recordEvent(
    {
      eventName: "jobs-workflows.cron_run",
      actorId: "cloudflare:scheduled",
      entityType: "job",
      entityId: "scheduled",
      source: "worker.scheduled",
      payload: {
        cron: event.cron ?? null,
        scheduledTime: event.scheduledTime ?? null,
        enqueued: scheduled.ok ? scheduled.data.enqueued : 0,
        ran: ran.ok ? ran.data.ran : 0
      }
    },
    { auditStore: stores.auditStore }
  );

  return { scheduled, ran };
}
