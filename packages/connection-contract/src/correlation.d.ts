import type { Meta } from "./envelope";

export const CORRELATION_HEADER: "x-msh-correlation-id";
export function newCorrelationId(): string;
export function withMeta(partial: Partial<Meta> & Omit<Meta, "correlationId">): Meta;
