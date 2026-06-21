import { describe, expect, it } from "vitest";
import {
  createPaymentIntent,
  handleWebhook,
  signWebhook,
  createMemoryPaymentRepository,
  createMemoryPaymentGateway
} from "@microservices-sh/payment";
import { createMemoryAuditEventStore } from "@microservices-sh/audit-log/adapters/memory";
import { createPlan, createMemoryBillingStore } from "@microservices-sh/billing-subscriptions";
import { createMemoryRbacStore } from "@microservices-sh/org-team-rbac/adapters/memory";
import {
  createMemoryAccountStore,
  createMemoryLoginCodeStore,
  createMemorySessionStore
} from "@microservices-sh/identity";
import { createMemoryRateLimitStore } from "@microservices-sh/gateway/adapters/memory-rate-limit";
import { actions as signupActions } from "../src/routes/signup/+page.server";
import { load as appLayoutLoad } from "../src/routes/app/+layout.server";
import { actions as billingActions } from "../src/routes/app/billing/+page.server";
import { getCurrentUser } from "../src/lib/server/session";

class MemoryCookies {
  private values = new Map<string, string>();
  get(name: string) {
    return this.values.get(name);
  }
  set(name: string, value: string) {
    this.values.set(name, value);
  }
  delete(name: string) {
    this.values.delete(name);
  }
  getAll() {
    return [...this.values].map(([name, value]) => ({ name, value }));
  }
  serialize(name: string, value: string) {
    this.set(name, value);
    return `${name}=${value}`;
  }
}

function formRequest(path: string, values: Record<string, string>): Request {
  const body = new FormData();
  for (const [key, value] of Object.entries(values)) body.set(key, value);
  return new Request(`http://localhost${path}`, { method: "POST", body });
}

function unwrap<T>(result: { ok: boolean; status: number; data?: T; error?: { message?: string } }): T {
  expect(result.ok, result.error?.message ?? `status ${result.status}`).toBe(true);
  if (!result.ok || !result.data) throw new Error(result.error?.message ?? `status ${result.status}`);
  return result.data;
}

describe("payment module round-trip", () => {
  it("creates an intent, then succeeds it on a validly signed webhook", async () => {
    const paymentRepository = createMemoryPaymentRepository();
    const paymentGateway = createMemoryPaymentGateway();

    const intent = unwrap(
      await createPaymentIntent(
        { customerId: "org_acme", amount: 4900, currency: "usd", description: "Growth plan" },
        { paymentRepository, paymentGateway }
      )
    ) as { payment: { id: string; intentId: string; status: string }; clientSecret: string };

    expect(intent.payment.status).toBe("pending");
    expect(intent.clientSecret).toMatch(/_secret_test$/);

    const secret = "whsec_test_secret";
    // Stripe rejects stale signatures, and handleWebhook verifies against the
    // current clock — sign with "now" so the timestamp stays within tolerance.
    const timestamp = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({
      id: "evt_1",
      type: "payment_intent.succeeded",
      data: { object: { id: intent.payment.intentId } }
    });

    // Tampered signature is rejected.
    const bad = await handleWebhook(body, "t=1,v1=deadbeef", { paymentRepository, webhookSecret: secret });
    expect(bad).toMatchObject({ ok: false, status: 401 });

    // Correctly signed webhook transitions the payment to succeeded.
    const signature = await signWebhook(body, secret, timestamp);
    const good = await handleWebhook(body, signature, { paymentRepository, webhookSecret: secret });
    expect(good.ok).toBe(true);
    expect((good as { data: { payment: { status: string } } }).data.payment.status).toBe("succeeded");

    // Idempotent: redelivering the same event id does not double-apply.
    const replay = await handleWebhook(body, signature, { paymentRepository, webhookSecret: secret });
    expect(replay).toMatchObject({ ok: true, data: { deduped: true } });
  });
});

describe("billing checkout action", () => {
  it("creates a Stripe payment intent for a paid plan, gated by org.manage", async () => {
    const cookies = new MemoryCookies();
    const billingStore = createMemoryBillingStore();
    unwrap(
      await createPlan(
        { name: "Growth", priceCents: 4900, currency: "usd", interval: "month", features: ["Everything"] },
        { store: billingStore }
      )
    );

    const locals: App.Locals = {
      rbacStore: createMemoryRbacStore(),
      billingStore,
      auditStore: createMemoryAuditEventStore(),
      tableGateway: {} as App.Locals["tableGateway"],
      signingKeyStore: {} as App.Locals["signingKeyStore"],
      accountStore: createMemoryAccountStore(),
      loginCodeStore: createMemoryLoginCodeStore(),
      sessionStore: createMemorySessionStore(),
      rateLimitStore: createMemoryRateLimitStore(),
      paymentRepository: createMemoryPaymentRepository(),
      paymentGateway: createMemoryPaymentGateway(),
      user: null
    };
    const platform = { env: {} } as unknown as App.Platform;

    // Sign up an owner so RBAC has the org + owner membership (org.manage).
    let thrown: unknown;
    try {
      await signupActions.default({
        request: formRequest("/signup", { email: "owner@example.com", orgName: "Acme Co", slug: "acme-co" }),
        cookies,
        locals,
        platform
      } as any);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toMatchObject({ status: 303, location: "/app" });

    locals.user = await getCurrentUser(cookies as any, {
      accountStore: locals.accountStore,
      sessionStore: locals.sessionStore
    });
    const layout = (await appLayoutLoad({ locals, cookies } as any)) as { activeOrgId: string | null };

    const planId = (await billingStore.listPlans())[0].id;
    const result = (await billingActions.checkout({
      request: formRequest("/app/billing", { orgId: layout.activeOrgId!, planId }),
      locals
    } as any)) as { ok?: boolean; clientSecret?: string; status?: number };

    expect(result.ok).toBe(true);
    expect(result.clientSecret).toMatch(/_secret_test$/);

    // A non-member cannot run checkout against this org.
    locals.user = { id: "usr_outsider", email: "outsider@example.com", isSuperAdmin: false };
    const denied = await billingActions.checkout({
      request: formRequest("/app/billing", { orgId: layout.activeOrgId!, planId }),
      locals
    } as any);
    expect(denied).toMatchObject({ status: 403 });
  });
});
