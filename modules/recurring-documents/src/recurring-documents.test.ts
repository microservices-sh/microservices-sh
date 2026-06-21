import { describe, expect, it } from "vitest";
import { createRecurringDocumentsMemoryStore } from "./adapters/memory";
import { createRecurringDocumentsService, createSequentialRecurringDocumentsIdFactory } from "./service";
import type { ModuleResult, TenantContext } from "./types";

function service() {
  return createRecurringDocumentsService({
    store: createRecurringDocumentsMemoryStore(),
    createId: createSequentialRecurringDocumentsIdFactory()
  });
}

function unwrap<T>(result: ModuleResult<T>): T {
  if (!result.ok || !result.data) throw new Error(result.error?.message ?? "Expected ok result");
  return result.data;
}

const ctx: TenantContext = {
  tenantId: "tenant_1",
  actorId: "user_1",
  now: "2026-01-01T00:00:00.000Z"
};

describe("recurring-documents service", () => {
  it("creates recurring invoice templates with cents totals and start date as next run", async () => {
    const recurring = service();
    const template = unwrap(
      await recurring.createRecurringDocumentTemplate(ctx, {
        name: "Monthly retainer",
        documentType: "invoice",
        partyId: "client_1",
        frequency: "monthly",
        taxBasisPoints: 800,
        discountCents: 1000,
        lines: [{ description: "Retainer", quantity: 2, unitPriceCents: 25000 }]
      })
    );

    expect(template.partyType).toBe("customer");
    expect(template.nextRunDate).toBe("2026-01-01T00:00:00.000Z");
    expect(template.subtotalCents).toBe(50000);
    expect(template.taxCents).toBe(3920);
    expect(template.totalCents).toBe(52920);
  });

  it("generates due documents and completes at max occurrences", async () => {
    const recurring = service();
    const template = unwrap(
      await recurring.createRecurringDocumentTemplate(ctx, {
        name: "Weekly vendor bill",
        documentType: "bill",
        partyId: "vendor_1",
        frequency: "weekly",
        maxOccurrences: 1,
        autoApprove: true,
        paymentTermsDays: 10,
        lines: [{ description: "Cleaning", quantity: 1, unitPriceCents: 12000 }]
      })
    );

    const generated = unwrap(await recurring.generateDueRecurringDocuments(ctx, { asOf: "2026-01-01T00:00:00.000Z" }));
    expect(generated.generated).toHaveLength(1);
    expect(generated.generated[0]?.documentType).toBe("bill");
    expect(generated.generated[0]?.status).toBe("approved");
    expect(generated.generated[0]?.dueDate).toBe("2026-01-11T00:00:00.000Z");

    const updated = unwrap(await recurring.getRecurringDocumentTemplate(ctx, template.id));
    expect(updated.status).toBe("completed");
    expect(updated.occurrencesGenerated).toBe(1);
    expect(updated.nextRunDate).toBeNull();
  });

  it("pauses and resumes active templates without generating paused documents", async () => {
    const recurring = service();
    const template = unwrap(
      await recurring.createRecurringDocumentTemplate(ctx, {
        name: "Quarterly invoice",
        documentType: "invoice",
        partyId: "client_2",
        frequency: "quarterly",
        lines: [{ description: "Planning", quantity: 1, unitPriceCents: 50000 }]
      })
    );

    const paused = unwrap(await recurring.pauseRecurringDocumentTemplate(ctx, { templateId: template.id }));
    expect(paused.status).toBe("paused");
    const none = unwrap(await recurring.generateDueRecurringDocuments(ctx, { asOf: "2026-01-01T00:00:00.000Z" }));
    expect(none.generated).toHaveLength(0);

    const resumed = unwrap(await recurring.resumeRecurringDocumentTemplate({ ...ctx, now: "2026-01-02T00:00:00.000Z" }, { templateId: template.id }));
    expect(resumed.status).toBe("active");
    expect(resumed.nextRunDate).toBe("2026-01-02T00:00:00.000Z");
  });
});
