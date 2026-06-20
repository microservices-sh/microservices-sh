export { moduleDefinition, manifest } from "./manifest";
export { defaultConfig, configSchema } from "./config";
export { events } from "./events";
export { permissions } from "./permissions";
export { resources } from "./resources";
export { notify } from "./use-cases/notify";
export type { NotifyResult } from "./use-cases/notify";
export { listNotifications } from "./use-cases/list-notifications";
export { markRead } from "./use-cases/mark-read";
export { markAllRead } from "./use-cases/mark-all-read";
export { getUnreadCount } from "./use-cases/get-unread-count";
export {
  listNotificationsScoped,
  markReadScoped,
  markAllReadScoped,
  getUnreadCountScoped
} from "./use-cases/scoped";
// Re-export the auth primitive so consumers of the *Scoped use-cases have a
// validated way to build the AuthContext they require (plan 33).
export { authContext } from "@microservices-sh/connection-contract";
export type { AuthContext } from "@microservices-sh/connection-contract";
export { beforeNotify, renderNotification } from "./hooks";
export { notificationsInappMeta } from "./meta";
export { createD1NotificationStore } from "./adapters/d1-notification-store";
export { createMemoryNotificationStore } from "./adapters/memory-notification-store";
export type { NotificationStore } from "./ports";
export type { Notification, NotificationListFilter, DomainEvent } from "./types";
