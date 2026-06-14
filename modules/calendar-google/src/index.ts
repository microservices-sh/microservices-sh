export { moduleDefinition, manifest } from "./manifest";
export { defaultConfig, configSchema } from "./config";
export { events } from "./events";
export { permissions } from "./permissions";
export { resources } from "./resources";

export { connectCalendar } from "./use-cases/connect-calendar";
export { refreshAccessToken } from "./use-cases/refresh-access-token";
export { syncCalendar } from "./use-cases/sync-calendar";
export { renewExpiringChannels } from "./use-cases/renew-expiring-channels";
export { handlePushNotification } from "./use-cases/handle-push-notification";
export { listEvents } from "./use-cases/list-events";
export { applyEvents, toCalendarEvent } from "./use-cases/upsert-events";

export { parseRRule, parseInstantMs, addInterval, expandRecurrence } from "./rrule";
export type { Frequency, ParsedRRule, ExpandWindow } from "./rrule";

export {
  createMemoryTokenStore,
  createMemorySyncStateStore,
  createMemoryChannelStore,
  createMemoryCalendarEventStore
} from "./adapters/memory-stores";
export {
  createD1TokenStore,
  createD1SyncStateStore,
  createD1ChannelStore,
  createD1CalendarEventStore
} from "./adapters/d1-stores";
export { createFetchGoogleCalendarClient } from "./adapters/fetch-google-client";
export type { FetchGoogleClientConfig } from "./adapters/fetch-google-client";

export type {
  GoogleCalendarClient,
  TokenStore,
  SyncStateStore,
  ChannelStore,
  CalendarEventStore
} from "./ports";
export type {
  CalendarConnection,
  CalendarToken,
  CalendarSyncState,
  CalendarChannel,
  CalendarEvent,
  RawGoogleEvent,
  ListEventsResult,
  RefreshedToken,
  WatchResult,
  ExpandedInstance
} from "./types";
