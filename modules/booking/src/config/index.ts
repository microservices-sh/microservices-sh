export const defaultConfig = {
  timezone: "UTC",
  slotIntervalMinutes: 60,
  defaultDurationMinutes: 60,
  maxFutureDays: 90
} as const;

export const configSchema = {
  type: "object",
  properties: {
    timezone: { type: "string" },
    slotIntervalMinutes: { type: "integer", minimum: 5 },
    defaultDurationMinutes: { type: "integer", minimum: 5 },
    maxFutureDays: { type: "integer", minimum: 1 }
  },
  additionalProperties: true
} as const;
