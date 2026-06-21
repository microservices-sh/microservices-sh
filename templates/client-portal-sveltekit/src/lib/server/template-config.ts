import type { StorageEntitlementsConfig } from "@microservices-sh/storage-entitlements";
import rawConfig from "../../../microservices.config.json";

interface TemplateConfig {
  storageEntitlements?: {
    defaultQuotaBytes?: number;
    defaultCurrency?: string;
  };
}

function positiveInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
}

function currency(value: unknown, fallback: string): string {
  return typeof value === "string" && /^[A-Z]{3}$/.test(value.trim().toUpperCase())
    ? value.trim().toUpperCase()
    : fallback;
}

const config = rawConfig as TemplateConfig;

export const storageEntitlementsConfig: StorageEntitlementsConfig = {
  enabled: true,
  defaultQuotaBytes: positiveInteger(config.storageEntitlements?.defaultQuotaBytes, 2147483648),
  defaultCurrency: currency(config.storageEntitlements?.defaultCurrency, "USD")
};
