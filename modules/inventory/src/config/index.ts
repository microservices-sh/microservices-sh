import { inventoryConfigSchema } from "../schemas";

export const configSchema = inventoryConfigSchema;
export const defaultConfig = configSchema.parse({ enabled: true, defaultLocationId: "default" });
