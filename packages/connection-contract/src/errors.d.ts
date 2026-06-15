export type ErrorCategory =
  | "validation" | "auth" | "scope" | "notFound" | "conflict" | "upstream" | "internal";

export const STATUS: Readonly<Record<ErrorCategory, number>>;
export function statusFor(category: ErrorCategory): number;
export function registerCodes(moduleId: string, names: string[]): void;
export function errorCode(moduleId: string, name: string): string;
export function __resetRegistry(): void;
