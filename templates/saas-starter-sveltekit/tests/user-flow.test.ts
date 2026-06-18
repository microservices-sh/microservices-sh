import { describe, expect, it } from "vitest";
import { createMemoryAuditEventStore } from "@microservices-sh/audit-log/adapters/memory";
import { createPlan, createMemoryBillingStore } from "@microservices-sh/billing-subscriptions";
import { createMemoryRbacStore } from "@microservices-sh/org-team-rbac/adapters/memory";
import { actions as signupActions } from "../src/routes/signup/+page.server";
import { load as appLayoutLoad } from "../src/routes/app/+layout.server";
import { load as appLoad } from "../src/routes/app/+page.server";
import { actions as billingActions, load as billingLoad } from "../src/routes/app/billing/+page.server";
import { getSessionSecret, readSession } from "../src/lib/server/session";

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

async function expectRedirect(run: () => Promise<unknown>, status: number, location: string): Promise<void> {
  let thrown: unknown;
  try {
    await run();
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toMatchObject({ status, location });
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
    { name: "Starter", priceCents: 1900, features: ["1 workspace", "Core SaaS shell"] },
    { name: "Growth", priceCents: 4900, features: ["5 workspaces", "Billing automations"] },
    { name: "Scale", priceCents: 9900, features: ["Unlimited workspaces", "Priority workflows"] }
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
  const platform = { env: { SESSION_SECRET: "template-user-flow-secret" } } as unknown as App.Platform;
  const locals: App.Locals = {
    rbacStore: createMemoryRbacStore(),
    billingStore: await seedBillingStore(),
    auditStore: createMemoryAuditEventStore(),
    tableGateway: {} as App.Locals["tableGateway"],
    signingKeyStore: {} as App.Locals["signingKeyStore"],
    user: null
  };

  return { cookies, locals, platform };
}

async function signUpOwner(context: Awaited<ReturnType<typeof createTestContext>>) {
  await expectRedirect(
    () =>
      signupActions.default({
        request: formRequest("/signup", { email: "owner@example.com", orgName: "Acme Co", slug: "acme-co" }),
        cookies: context.cookies,
        locals: context.locals,
        platform: context.platform
      } as any),
    303,
    "/app"
  );

  context.locals.user = await readSession(context.cookies as any, getSessionSecret(context.platform));
  expect(context.locals.user).toMatchObject({ email: "owner@example.com", isSuperAdmin: false });

  const layout = await appLayoutLoad({ locals: context.locals, cookies: context.cookies } as any);
  expect(layout).toMatchObject({
    activeOrg: { name: "Acme Co", slug: "acme-co" },
    permissions: ["*"]
  });

  return layout;
}

describe("SaaS starter user flow", () => {
  it("signs up an org owner and manages a subscription through app route actions", async () => {
    const context = await createTestContext();

    await expectRedirect(() => appLayoutLoad({ locals: context.locals, cookies: context.cookies } as any), 303, "/login");

    const layout = await signUpOwner(context);
    const parent = async () => layout;
    const dashboardBeforeBilling = await appLoad({ locals: context.locals, parent } as any);
    expect(dashboardBeforeBilling).toMatchObject({
      onboarding: false,
      memberCount: 1,
      subscription: null
    });

    const billingBeforeSelection = await billingLoad({ locals: context.locals, parent } as any);
    expect(billingBeforeSelection.canManageBilling).toBe(true);
    expect(billingBeforeSelection.subscription).toBeNull();
    expect(billingBeforeSelection.plans.map((plan) => plan.name)).toEqual(["Starter", "Growth", "Scale"]);

    const growthPlan = billingBeforeSelection.plans.find((plan) => plan.name === "Growth");
    expect(growthPlan).toBeDefined();
    const startResult = await billingActions.selectPlan({
      request: formRequest("/app/billing", { orgId: layout.activeOrgId!, planId: growthPlan!.id }),
      locals: context.locals
    } as any);
    expect(startResult).toEqual({ ok: true, started: true });

    const billingAfterSelection = await billingLoad({ locals: context.locals, parent } as any);
    expect(billingAfterSelection.subscription).toMatchObject({
      planId: growthPlan!.id,
      status: "trialing",
      hasAccess: true
    });

    const dashboardAfterBilling = await appLoad({ locals: context.locals, parent } as any);
    expect(dashboardAfterBilling.subscription).toMatchObject({
      planId: growthPlan!.id,
      status: "trialing",
      hasAccess: true
    });

    const scalePlan = billingAfterSelection.plans.find((plan) => plan.name === "Scale");
    expect(scalePlan).toBeDefined();
    const changeResult = await billingActions.selectPlan({
      request: formRequest("/app/billing", {
        orgId: layout.activeOrgId!,
        planId: scalePlan!.id,
        subscriptionId: billingAfterSelection.subscription!.id
      }),
      locals: context.locals
    } as any);
    expect(changeResult).toEqual({ ok: true, changed: true });

    const billingAfterPlanChange = await billingLoad({ locals: context.locals, parent } as any);
    expect(billingAfterPlanChange.subscription).toMatchObject({
      id: billingAfterSelection.subscription!.id,
      planId: scalePlan!.id,
      status: "trialing",
      hasAccess: true
    });
  });

  it("keeps billing mutations behind org management permission", async () => {
    const context = await createTestContext();
    const layout = await signUpOwner(context);
    const parent = async () => layout;
    const billingState = await billingLoad({ locals: context.locals, parent } as any);
    const starterPlan = billingState.plans[0];

    context.locals.user = { id: "usr_outsider", email: "outsider@example.com", isSuperAdmin: false };

    const denied = await billingActions.selectPlan({
      request: formRequest("/app/billing", { orgId: layout.activeOrgId!, planId: starterPlan.id }),
      locals: context.locals
    } as any);

    expect(denied).toMatchObject({
      status: 403,
      data: { error: "You do not have permission to manage billing." }
    });
  });
});
