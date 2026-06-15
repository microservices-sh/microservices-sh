import type { RequestHandler } from "./$types";
import {
  parseSessionCookie,
  clearSessionCookie,
  destroySession,
  createD1SessionStore
} from "@microservices-sh/identity";

// Ends the human session: deletes the server-side session row (so it is revoked,
// not merely forgotten) and clears the cookie. Returns a 303 redirect to /login.
// We build the Response by hand so the clear-cookie header is set on the same
// response as the redirect (throwing `redirect()` would skip the header).
export const POST: RequestHandler = async ({ request, platform }) => {
  const sessionId = parseSessionCookie(request.headers.get("cookie"));
  const db = platform?.env?.DB;
  if (sessionId && db) {
    await destroySession({ sessionId }, { sessionStore: createD1SessionStore(db) });
  }
  return new Response(null, {
    status: 303,
    headers: { location: "/login", "set-cookie": clearSessionCookie() }
  });
};
