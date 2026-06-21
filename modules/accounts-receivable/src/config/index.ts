import { accountsReceivableConfigSchema } from "../schemas";

export const defaultConfig = accountsReceivableConfigSchema.parse({});

export { accountsReceivableConfigSchema as configSchema };
