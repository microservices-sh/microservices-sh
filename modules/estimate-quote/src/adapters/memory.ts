import type { EstimateQuoteStore } from "../ports";
import type { EstimateQuote, EstimateQuoteListFilter, EstimateQuoteStatus } from "../types";

export interface EstimateQuoteMemoryStoreState {
  quotes?: EstimateQuote[];
}

const STATUSES: EstimateQuoteStatus[] = ["draft", "sent", "viewed", "accepted", "declined", "expired", "converted", "void"];

function copy<T>(value: T): T {
  return structuredClone(value);
}

function matchesFilter(quote: EstimateQuote, filter?: EstimateQuoteListFilter): boolean {
  if (filter?.status && quote.status !== filter.status) return false;
  if (filter?.clientId && quote.clientId !== filter.clientId) return false;
  if (filter?.numberSearch && !quote.quoteNumber.toLowerCase().includes(filter.numberSearch.toLowerCase())) return false;
  if (filter?.issueDateFrom && quote.issueDate < filter.issueDateFrom) return false;
  if (filter?.issueDateTo && quote.issueDate > filter.issueDateTo) return false;
  return true;
}

function tenantKey(tenantId: string, quoteNumber: string): string {
  return `${tenantId}:${quoteNumber}`;
}

export function createEstimateQuoteMemoryStore(initialState: EstimateQuoteMemoryStoreState = {}): EstimateQuoteStore {
  const quotes = new Map<string, EstimateQuote>();
  const numbers = new Map<string, string>();

  for (const quote of initialState.quotes ?? []) {
    quotes.set(quote.id, copy(quote));
    numbers.set(tenantKey(quote.tenantId, quote.quoteNumber), quote.id);
  }

  return {
    async getQuote(tenantId, quoteId) {
      const quote = quotes.get(quoteId);
      return quote?.tenantId === tenantId ? copy(quote) : null;
    },

    async getQuoteByNumber(tenantId, quoteNumber) {
      const quoteId = numbers.get(tenantKey(tenantId, quoteNumber));
      const quote = quoteId ? quotes.get(quoteId) : null;
      return quote ? copy(quote) : null;
    },

    async getLatestQuoteNumber(tenantId, prefix) {
      const latest = [...quotes.values()]
        .filter((quote) => quote.tenantId === tenantId && quote.quoteNumber.startsWith(`${prefix}-`))
        .sort((a, b) => b.quoteNumber.localeCompare(a.quoteNumber, undefined, { numeric: true }))[0];
      return latest?.quoteNumber ?? null;
    },

    async insertQuote(quote) {
      quotes.set(quote.id, copy(quote));
      numbers.set(tenantKey(quote.tenantId, quote.quoteNumber), quote.id);
    },

    async updateQuote(quote) {
      quotes.set(quote.id, copy(quote));
      numbers.set(tenantKey(quote.tenantId, quote.quoteNumber), quote.id);
    },

    async listQuotes(tenantId, filter) {
      const rows = [...quotes.values()]
        .filter((quote) => quote.tenantId === tenantId && matchesFilter(quote, filter))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const offset = filter?.offset ?? 0;
      const limit = filter?.limit ?? rows.length;
      return { quotes: rows.slice(offset, offset + limit).map(copy), total: rows.length };
    },

    async listExpirableQuotes(tenantId, asOf, limit) {
      const rows = [...quotes.values()]
        .filter((quote) => quote.tenantId === tenantId && (quote.status === "sent" || quote.status === "viewed") && quote.expiryDate !== null && quote.expiryDate < asOf)
        .sort((a, b) => (a.expiryDate ?? "").localeCompare(b.expiryDate ?? ""));
      return rows.slice(0, limit ?? rows.length).map(copy);
    },

    async countQuotesByStatus(tenantId) {
      const counts = Object.fromEntries(STATUSES.map((status) => [status, 0])) as Record<EstimateQuoteStatus, number>;
      for (const quote of quotes.values()) {
        if (quote.tenantId === tenantId) counts[quote.status] += 1;
      }
      return counts;
    }
  };
}
