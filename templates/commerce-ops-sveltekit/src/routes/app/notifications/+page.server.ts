import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { listNotifications, markRead, markAllRead } from "@microservices-sh/notifications-inapp";
import { requireModule } from "$lib/server/modules";

// Reference UI for @microservices-sh/notifications-inapp. The in-app feed is
// USER-scoped (not org-scoped): every read/write is keyed to locals.user.id, so
// an employee only ever sees and mutates their own notifications. Notifications
// are produced by OTHER modules calling notify() on domain events — this page is
// the read + mark-read surface.
export const load: PageServerLoad = async ({ locals, parent, platform }) => {
  requireModule("notifications-inapp", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const result = await listNotifications(
    { userId: locals.user.id, limit: 50 },
    { store: locals.notificationStore }
  );
  const notifications = result.ok ? result.data.notifications : [];

  return {
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      readAt: n.readAt,
      createdAt: n.createdAt
    })),
    unread: notifications.filter((n) => !n.readAt).length
  };
};

export const actions: Actions = {
  markRead: async ({ request, locals, platform }) => {
    requireModule("notifications-inapp", platform);
    if (!locals.user) return fail(403, { error: "Not signed in." });
    const id = String((await request.formData()).get("id") ?? "").trim();
    if (id) await markRead({ ids: [id], userId: locals.user.id }, { store: locals.notificationStore });
    return { ok: true };
  },
  markAll: async ({ locals, platform }) => {
    requireModule("notifications-inapp", platform);
    if (!locals.user) return fail(403, { error: "Not signed in." });
    await markAllRead({ userId: locals.user.id }, { store: locals.notificationStore });
    return { ok: true };
  }
};
