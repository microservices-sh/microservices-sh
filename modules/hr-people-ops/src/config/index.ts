import { hrPeopleOpsConfigSchema } from "../schemas";

export const configSchema = hrPeopleOpsConfigSchema;
export const defaultConfig = configSchema.parse({ enabled: true });
