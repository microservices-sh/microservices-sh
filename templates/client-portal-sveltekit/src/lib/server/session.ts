import type { Cookies } from "@sveltejs/kit";
import { dev } from "$app/environment";
import {
  readSession as identityReadSession,
  destroySession,
  SESSION_COOKIE,
  type AccountStore,
  type SessionStore
} from "@microservices-sh/identity";
import type { CustomerRepository } from "@microservices-sh/customer/ports";

export { SESSION_COOKIE };

export interface PortalUser {
  id: string;
  email: string;
  role: "customer" | "staff";
  customerId: string | null;
}

export interface PortalSessionDeps {
  accountStore: AccountStore;
  sessionStore: SessionStore;
  customerRepository: CustomerRepository;
}

export function adminEmailsFor(platform: App.Platform | undefined): string[] {
  const env = (platform?.env ?? {}) as { ADMIN_EMAILS?: string };
  const fromEnv = (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return dev && fromEnv.length === 0 ? ["staff@example.com"] : fromEnv;
}

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function cookieOptions() {
  return { path: "/", httpOnly: true, sameSite: "lax" as const, secure: !dev, maxAge: COOKIE_MAX_AGE };
}

export function setSessionCookie(cookies: Cookies, sessionId: string): void {
  cookies.set(SESSION_COOKIE, sessionId, cookieOptions());
}

export async function resolvePortalUser(
  input: { id: string; email: string; isAdmin: boolean },
  deps: { customerRepository: CustomerRepository }
): Promise<PortalUser | null> {
  if (input.isAdmin) {
    return { id: input.id, email: input.email, role: "staff", customerId: null };
  }

  const customer = await deps.customerRepository.findCustomerByEmail(input.email);
  if (!customer) return null;
  return { id: input.id, email: input.email, role: "customer", customerId: customer.id };
}

export async function getCurrentUser(cookies: Cookies, deps: PortalSessionDeps): Promise<PortalUser | null> {
  const sessionId = cookies.get(SESSION_COOKIE);
  if (!sessionId) return null;

  const result = await identityReadSession(
    { sessionId },
    { accountStore: deps.accountStore, sessionStore: deps.sessionStore }
  );
  if (!result.ok || !result.data.user) return null;

  return resolvePortalUser(result.data.user, { customerRepository: deps.customerRepository });
}

export async function endSession(cookies: Cookies, sessionStore: SessionStore): Promise<void> {
  const sessionId = cookies.get(SESSION_COOKIE);
  if (sessionId) await destroySession({ sessionId }, { sessionStore });
  cookies.delete(SESSION_COOKIE, { path: "/" });
  cookies.delete("portal_role", { path: "/" });
}
