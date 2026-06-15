import type { Identity } from "./better-auth";
import type { IdentityUser } from "./bridge";

export interface ResolvedSession {
  user: IdentityUser;
  sessionId: string;
}

// Reads the Better Auth session for an incoming request and normalizes it to the
// IdentityUser the templates + bridge expect. Returns null when signed out — the
// SSR /admin and /portal layout guards fail closed on null. Hooks call this and
// set `locals.user`.
export async function getSession(auth: Identity, request: Request): Promise<ResolvedSession | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return null;

  const u = session.user as { id: string; email: string; isAdmin?: boolean; role?: string };
  return {
    user: {
      id: u.id,
      email: u.email,
      isAdmin: Boolean(u.isAdmin),
      role: u.role
    },
    sessionId: session.session.id
  };
}
