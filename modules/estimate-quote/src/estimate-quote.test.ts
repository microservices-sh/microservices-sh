import { describe, expect, it } from "vitest";
import { createEstimateQuoteMemoryStore } from "./adapters/memory";
import { createEstimateQuoteService, createSequentialEstimateQuoteIdFactory } from "./service";
import type { ModuleResult, TenantContext } from "./types";

function service() {
  return createEstimateQuoteService({
    store: createEstimateQuoteMemoryStore(),
    createId: createSequentialEstimateQuoteIdFactory()
  });
}

function unwrap<T>(result: ModuleResult<T>): T {
  if (!result.ok || !result.data) throw new Error(result.error?.message ?? "Expected ok result");
  return result.data;
}

const ctx: TenantContext = {
  tenantId: "tenant_1",
  actorId: "user_1",
  now: "2026-01-01T10:00:00.000Z"
};

describe("estimate-quote service", () => {
  it("creates numbered draft quotes with cents-based totals", async () => {
    const quotes = service();
    const quote = unwrap(
      await quotes.createEstimateQuote(ctx, {
        clientId: "client_1",
        taxBasisPoints: 800,
        discountCents: 500,
        lines: [
          { description: "Discovery", quantity: 2, unitPriceCents: 12500 },
          { description: "Implementation", quantity: 1.5, unitPriceCents: 20000 }
        ]
      })
    );

    expect(quote.quoteNumber).toBe("EST-00001");
    expect(quote.status).toBe("draft");
    expect(quote.subtotalCents).toBe(55000);
    expect(quote.taxCents).toBe(4360);
    expect(quote.totalCents).toBe(58860);
    expect(quote.expiryDate).toBe("2026-01-31T10:00:00.000Z");
    expect(quote.lines).toHaveLength(2);
  });

  it("moves through sent, viewed, accepted, and converted states idempotently", async () => {
    const quotes = service();
    const quote = unwrap(
      await quotes.createEstimateQuote(ctx, {
        clientId: "client_1",
        lines: [{ description: "Retainer", quantity: 1, unitPriceCents: 100000 }]
      })
    );

    const sent = unwrap(await quotes.sendEstimateQuote(ctx, { quoteId: quote.id }));
    expect(sent.status).toBe("sent");
    const viewed = unwrap(await quotes.markEstimateQuoteViewed(ctx, { quoteId: quote.id }));
    expect(viewed.status).toBe("viewed");
    const accepted = unwrap(await quotes.acceptEstimateQuote(ctx, { quoteId: quote.id }));
    expect(accepted.status).toBe("accepted");

    const conversion = unwrap(await quotes.convertEstimateQuote(ctx, { quoteId: quote.id, invoiceId: "inv_1" }));
    expect(conversion.quote.status).toBe("converted");
    expect(conversion.quote.convertedToInvoiceId).toBe("inv_1");
    expect(conversion.invoiceDraft.sourceQuoteNumber).toBe("EST-00001");
    expect(conversion.invoiceDraft.amountDueCents).toBe(100000);

    const again = unwrap(await quotes.convertEstimateQuote(ctx, { quoteId: quote.id, invoiceId: "inv_2" }));
    expect(again.quote.convertedToInvoiceId).toBe("inv_1");
  });

  it("expires stale pending quotes and reports viewed quotes as pending sent value", async () => {
    const quotes = service();
    const fresh = unwrap(
      await quotes.createEstimateQuote(ctx, {
        clientId: "client_1",
        expiryDate: "2026-02-01T00:00:00.000Z",
        lines: [{ description: "Fresh", quantity: 1, unitPriceCents: 3000 }]
      })
    );
    const stale = unwrap(
      await quotes.createEstimateQuote(ctx, {
        clientId: "client_2",
        expiryDate: "2025-12-01T00:00:00.000Z",
        lines: [{ description: "Stale", quantity: 1, unitPriceCents: 7000 }]
      })
    );

    await quotes.sendEstimateQuote(ctx, { quoteId: fresh.id });
    await quotes.markEstimateQuoteViewed(ctx, { quoteId: fresh.id });
    await quotes.sendEstimateQuote(ctx, { quoteId: stale.id });

    const expired = unwrap(await quotes.expireEstimateQuotes(ctx, { asOf: "2026-01-02T00:00:00.000Z" }));
    expect(expired.map((quote) => quote.id)).toEqual([stale.id]);

    const stats = unwrap(await quotes.getEstimateQuoteStats({ ...ctx, now: "2026-01-02T00:00:00.000Z" }));
    expect(stats.sent).toBe(1);
    expect(stats.expired).toBe(1);
    expect(stats.pendingValueCents).toBe(3000);
  });
});
