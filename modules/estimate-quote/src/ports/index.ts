import type { EstimateQuote, EstimateQuoteListFilter, EstimateQuoteStatus } from "../types";

export interface EstimateQuoteStore {
  getQuote(tenantId: string, quoteId: string): Promise<EstimateQuote | null>;
  getQuoteByNumber(tenantId: string, quoteNumber: string): Promise<EstimateQuote | null>;
  getLatestQuoteNumber(tenantId: string, prefix: string): Promise<string | null>;
  insertQuote(quote: EstimateQuote): Promise<void>;
  updateQuote(quote: EstimateQuote): Promise<void>;
  listQuotes(tenantId: string, filter?: EstimateQuoteListFilter): Promise<{ quotes: EstimateQuote[]; total: number }>;
  listExpirableQuotes(tenantId: string, asOf: string, limit?: number): Promise<EstimateQuote[]>;
  countQuotesByStatus(tenantId: string): Promise<Record<EstimateQuoteStatus, number>>;
}
