import type { RequestHandler } from "./$types";
import { json } from "@sveltejs/kit";
import { rotateSigningKey, getJwks } from "@microservices-sh/auth";
import { createApiKey } from "@microservices-sh/gateway";
import { toSvelteKitResponse } from "$lib/server/adapters/sveltekit-response";

// Constant-time string comparison — avoids leaking the token via timing.
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i += 1) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

// One-time first-run setup: create the initial signing key and an owner API key
// with full scopes. Self-disables once a signing key exists.
//
// SECURITY: this mints an admin-scoped key, so it is gated behind a
// BOOTSTRAP_TOKEN shared secret (server-only binding). If the binding is unset
// the route fails closed (404) — production deploys must set it explicitly, and
// unauthenticated callers cannot tell the route exists. Prefer bootstrapping via
// the control plane / CLI; remove this route once the app is initialized.
export const POST: RequestHandler = async ({ request, locals, platform }) => {
  const expected = platform?.env?.BOOTSTRAP_TOKEN;
  const provided = request.headers.get("x-bootstrap-token");
  if (!expected || !provided || !timingSafeEqual(provided, expected)) {
    return new Response("Not found", { status: 404 });
  }

  const existing = await getJwks({ signingKeyStore: locals.signingKeyStore });
  if (existing.data.keys.length > 0) {
    return json({ ok: false, error: "Already initialized." }, { status: 403 });
  }

  await rotateSigningKey({ signingKeyStore: locals.signingKeyStore });

  const body = (await request.json().catch(() => ({}))) as { workspace?: string; project?: string; subject?: string };
  const created = await createApiKey(
    {
      workspace: body.workspace ?? "default",
      project: body.project ?? "default",
      subject: body.subject ?? "owner",
      scopes: ["gateway.admin", "booking.read", "booking.write", "customer.read", "customer.write"]
    },
    { apiKeyStore: locals.apiKeyStore }
  );

  return toSvelteKitResponse(created);
};
