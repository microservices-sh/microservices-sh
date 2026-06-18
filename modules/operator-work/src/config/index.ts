import { operatorWorkConfigSchema } from "../schemas";
import type { OperatorWorkConfig } from "../schemas";

export const configSchema = operatorWorkConfigSchema;
export const defaultConfig = {
  maxTasks: 100,
  allowAgentDrafts: true,
  requireReviewBeforeUnlock: true
} satisfies OperatorWorkConfig;
