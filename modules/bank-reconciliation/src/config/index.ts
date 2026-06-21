import { bankReconciliationConfigSchema } from "../schemas";

export const configSchema = bankReconciliationConfigSchema;
export const defaultConfig = configSchema.parse({
  enabled: true,
  defaultCurrency: "USD",
  defaultDateToleranceDays: 3,
  defaultAmountToleranceCents: 0
});
