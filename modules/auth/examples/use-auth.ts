/* ─────────────────────────────────────────────────────────────────────────
   Worked example: use the auth module end to end.

   The reference an AI agent (or a developer) should read to learn how to call
   the auth use cases — what to import, how to wire the signing-key store, and
   how to handle the Result envelope. It is framework-neutral and runs against
   the in-memory store, so it works with no database or secrets.

   Run it:  npx tsx examples/use-auth.ts   (from the auth module root)

   Auth use cases return the shared Result envelope, a discriminated union:
   `{ ok: true, status, data, meta }` or `{ ok: false, status, error, meta }`.
   Narrow with `if (!result.ok)` (or isOk/isErr) — no "in" checks needed.

   In a real app the dispatcher/edge calls these (mint at the gateway, verify at
   each service). See the booking-sveltekit template hooks.server.ts for the
   signing-key store wiring, and the gateway module for mint-on-request.
   ───────────────────────────────────────────────────────────────────────── */
import { mintToken, verifyToken, getJwks, rotateSigningKey } from "@microservices-sh/auth";
import { createAuthDeps } from "@microservices-sh/auth/deps";

async function main() {
  // 1. Wire dependencies. No env → in-memory signing-key store.
  const deps = createAuthDeps();

  // 2. Rotate to create an active signing key. The store starts empty, so this
  //    must run before minting (mintToken errors with NO_ACTIVE_SIGNING_KEY
  //    otherwise). In production this is an operational/cron action.
  const rotated = await rotateSigningKey(deps);
  console.log(`Active signing key: ${rotated.data.kid}`);

  // 3. Mint a short-lived token for an actor with the scopes a downstream
  //    operation needs. The gateway typically does this per request.
  const minted = await mintToken(
    {
      subject: "user_ada",
      workspace: "ws_demo",
      project: "proj_demo",
      scopes: ["booking.read", "booking.write"],
      ttlSeconds: 60,
    },
    deps,
  );
  if (!minted.ok) {
    console.error(`Mint failed (${minted.status}):`, minted.error);
    return;
  }
  console.log(`Minted token (kid ${minted.data.kid}) with scopes:`, minted.data.claims.scopes);

  // 4. Verify the token — what a callee service does on each request before
  //    checking scopes against its own permissions.
  const verified = await verifyToken({ token: minted.data.token }, deps);
  if (!verified.ok) {
    console.error(`Verify failed (${verified.status}):`, verified.error);
    return;
  }
  console.log(`Verified token for subject: ${verified.data.claims.sub}`);

  // 5. Publish the JWKS (public keys) — what an /.well-known/jwks.json route
  //    serves so other services can verify offline.
  const jwks = await getJwks(deps);
  if (jwks.ok) console.log(`JWKS exposes ${jwks.data.keys.length} public key(s)`);
}

main().catch((error) => {
  console.error(error);
});
