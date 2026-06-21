import { describe, expect, it } from "vitest";
import { createMemoryAuditEventStore } from "@microservices-sh/audit-log/adapters/memory";
import { createPlan, createMemoryBillingStore } from "@microservices-sh/billing-subscriptions";
import { createMemoryRbacStore } from "@microservices-sh/org-team-rbac/adapters/memory";
import {
  createMemoryAccountStore,
  createMemoryLoginCodeStore,
  createMemorySessionStore,
  requestLoginCode
} from "@microservices-sh/identity";
import { createMemoryRateLimitStore } from "@microservices-sh/gateway/adapters/memory-rate-limit";
import { actions as signupActions } from "../src/routes/signup/+page.server";
import { load as appLayoutLoad } from "../src/routes/app/+layout.server";
import { actions as billingActions, load as billingLoad } from "../src/routes/app/billing/+page.server";
import { actions as teamActions, load as teamLoad } from "../src/routes/app/team/+page.server";
import { load as adminLayoutLoad } from "../src/routes/admin/+layout.server";
import { getCurrentUser } from "../src/lib/server/session";

// ---- minimal in-memory harness (mirrors tests/user-flow.test.ts) ----

class MemoryCookies {
  private values = new Map<string, string>();
  get(name: string): string | undefined {
    return this.values.get(name);
  }
  set(name: string, value: string): void {
    this.values.set(name, value);
  }
  delete(name: string): void {
    this.values.delete(name);
  }
  getAll(): Array<{ name: string; value: string }> {
    return [...this.values].map(([name, value]) => ({ name, value }));
  }
  serialize(name: string, value: string): string {
    this.set(name, value);
    return `${name}=${value}`;
  }
}

function formRequest(path: string, values: Record<string, string>): Request {
  const body = new FormData();
  for (const [key, value] of Object.entries(values)) body.set(key, value);
  return new Request(`http://localhost${path}`, { method: "POST", body });
}

async function expectThrow(run: () => Promise<unknown>): Promise<unknown> {
  let thrown: unknown;
  try {
    await run();
  } catch (error) {
    thrown = error;
  }
  expect(thrown, "expected the loader to throw").toBeDefined();
  return thrown;
}

function unwrap<T>(result: { ok: boolean; status: number; data?: T; error?: { message?: string } }): T {
  expect(result.ok, result.error?.message ?? `Unexpected status ${result.status}`).toBe(true);
  if (!result.ok || !result.data) throw new Error(result.error?.message ?? `Unexpected status ${result.status}`);
  return result.data;
}

async function seedBillingStore() {
  const billingStore = createMemoryBillingStore();
  const now = () => Date.parse("2026-01-01T00:00:00.000Z");
  for (const plan of [
    { name: "Starter", priceCents: 1900, features: ["1 workspace"] },
    { name: "Growth", priceCents: 4900, features: ["5 workspaces"] }
  ]) {
    unwrap(
      await createPlan(
        { ...plan, currency: "usd", interval: "month", stripePriceId: `price_${plan.name.toLowerCase()}` },
        { store: billingStore, now }
      )
    );
  }
  return billingStore;
}

async function createTestContext() {
  const cookies = new MemoryCookies();
  const platform = { env: {} } as unknown as App.Platform;
  const locals: App.Locals = {
    rbacStore: createMemoryRbacStore(),
    billingStore: await seedBillingStore(),
    auditStore: createMemoryAuditEventStore(),
    tableGateway: {} as App.Locals["tableGateway"],
    signingKeyStore: {} as App.Locals["signingKeyStore"],
    accountStore: createMemoryAccountStore(),
    loginCodeStore: createMemoryLoginCodeStore(),
    sessionStore: createMemorySessionStore(),
    rateLimitStore: createMemoryRateLimitStore(),
    user: null
  };
  return { cookies, locals, platform };
}

type Ctx = Awaited<ReturnType<typeof createTestContext>>;

// Sign up an org owner. Leaves locals.user set to the NEW owner (the signup
// rotates the session cookie), so the most recent sign-up is the "current" user.
async function signUpOwner(ctx: Ctx, opts: { email: string; orgName: string; slug: string }) {
  // Mirror the two-step signup: obtain a code the way step 1 would, then submit
  // it to the verify step. The code must round-trip — it is never self-served.
  const codeRes = await requestLoginCode(
    { email: opts.email },
    { accountStore: ctx.locals.accountStore, loginCodeStore: ctx.locals.loginCodeStore, adminEmails: [] }
  );
  const code = (codeRes as { ok: boolean; data?: { code: string } }).data!.code;
  const thrown = await expectThrow(() =>
    signupActions.verify({
      request: formRequest("/signup", { email: opts.email, orgName: opts.orgName, slug: opts.slug, code }),
      cookies: ctx.cookies,
      locals: ctx.locals,
      platform: ctx.platform
    } as any)
  );
  expect(thrown).toMatchObject({ status: 303, location: "/app" });

  ctx.locals.user = await getCurrentUser(ctx.cookies as any, {
    accountStore: ctx.locals.accountStore,
    sessionStore: ctx.locals.sessionStore
  });
  expect(ctx.locals.user?.email).toBe(opts.email);

  const layout = await appLayoutLoad({ locals: ctx.locals, cookies: ctx.cookies } as any);
  return layout as { activeOrgId: string | null; activeOrg: { slug: string } | null; permissions: string[] };
}

describe("tenant isolation", () => {
  it("scopes reads to the active org and blocks cross-org writes", async () => {
    const ctx = await createTestContext();

    // Org A: owner signs up and starts a subscription.
    const a = await signUpOwner(ctx, { email: "owner-a@example.com", orgName: "Acme Co", slug: "acme-co" });
    const aBilling = await billingLoad({ locals: ctx.locals, parent: async () => a } as any);
    const growth = aBilling.plans.find((p) => p.name === "Growth")!;
    expect(growth).toBeDefined();
    const started = await billingActions.selectPlan({
      request: formRequest("/app/billing", { orgId: a.activeOrgId!, planId: growth.id }),
      locals: ctx.locals
    } as any);
    expect(started).toEqual({ ok: true, started: true });

    // Org B: a second owner signs up — now the current user.
    const b = await signUpOwner(ctx, { email: "owner-b@example.com", orgName: "Globex", slug: "globex" });
    const bParent = async () => b;
    expect(b.activeOrg?.slug).toBe("globex");
    expect(b.activeOrgId).not.toBe(a.activeOrgId);

    // Read isolation: B's billing shows B's (none), never A's subscription.
    const bBilling = await billingLoad({ locals: ctx.locals, parent: bParent } as any);
    expect(bBilling.subscription).toBeNull();

    // Read isolation: B's team roster is only B, not A's members.
    const bTeam = await teamLoad({ locals: ctx.locals, cookies: ctx.cookies, parent: bParent } as any);
    expect(bTeam.members).toHaveLength(1);
    expect(bTeam.members[0]?.userId ?? bTeam.members[0]?.id).toBe(ctx.locals.user!.id);

    // Write isolation: B forging A's orgId cannot mutate A's billing.
    const billingForge = await billingActions.selectPlan({
      request: formRequest("/app/billing", { orgId: a.activeOrgId!, planId: growth.id }),
      locals: ctx.locals
    } as any);
    expect(billingForge).toMatchObject({ status: 403 });

    // Write isolation: B forging A's orgId cannot invite into A's team.
    const inviteForge = await teamActions.invite({
      request: formRequest("/app/team", { orgId: a.activeOrgId!, email: "intruder@example.com", role: "member" }),
      locals: ctx.locals,
      cookies: ctx.cookies
    } as any);
    expect(inviteForge).toMatchObject({ status: 403 });
  });
});

describe("admin authz", () => {
  it("gates the super-admin area on the platform flag, not an org role", async () => {
    const ctx = await createTestContext();

    // Unauthenticated → redirect to login.
    ctx.locals.user = null;
    const anon = await expectThrow(() => adminLayoutLoad({ locals: ctx.locals } as any));
    expect(anon).toMatchObject({ status: 303, location: "/login" });

    // Signed-in org owner WITHOUT the super-admin flag → 403.
    ctx.locals.user = { id: "usr_owner", email: "owner@example.com", isSuperAdmin: false };
    const denied = await expectThrow(() => adminLayoutLoad({ locals: ctx.locals } as any));
    expect(denied).toMatchObject({ status: 403 });

    // Super-admin → allowed, gets the resource registry.
    ctx.locals.user = { id: "usr_root", email: "root@example.com", isSuperAdmin: true };
    const ok = (await adminLayoutLoad({ locals: ctx.locals } as any)) as { resources: unknown[] };
    expect(Array.isArray(ok.resources)).toBe(true);
  });
});

describe("signup email verification", () => {
  it("rejects signup with a code the user never received", async () => {
    const ctx = await createTestContext();

    // Attacker submits the verify step with a forged code for an email they do
    // not control. No account, org, or session may be created — the code must
    // come from the inbox, never from the server.
    const denied = await signupActions.verify({
      request: formRequest("/signup", { email: "victim@example.com", orgName: "Victim Co", slug: "victim-co", code: "000000" }),
      cookies: ctx.cookies,
      locals: ctx.locals,
      platform: ctx.platform
    } as any);
    expect((denied as { status?: number }).status).toBeGreaterThanOrEqual(400);

    const user = await getCurrentUser(ctx.cookies as any, {
      accountStore: ctx.locals.accountStore,
      sessionStore: ctx.locals.sessionStore
    });
    expect(user).toBeNull();
  });
});
