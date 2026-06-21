import { shipmentConfigSchema } from "../schemas";

export const configSchema = shipmentConfigSchema;
export const defaultConfig = configSchema.parse({ enabled: true });
