import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { authContext, listInvoicesScoped } from "@microservices-sh/invoice";
import { getAccountingSetupStatus } from "@microservices-sh/accounting-core";
import { listDeliveries, listEndpoints } from "@microservices-sh/webhook-delivery";
import { requireOrgPermission } from "$lib/server/org-context";
import { requireModule } from "$lib/server/modules";
import { getEmailProviderHealth, getStripeProviderHealth } from "$lib/server/provider-health";

function keyMode(secret: string | undefined): string {
  const value = secret?.trim() ?? "";
  if (value.startsWith("sk_test_")) return "test";
  if (value.startsWith("sk_live_")) return "live";
  return value ? "configured" : "memory";
}

function latestDate(values: (string | null)[]): string | null {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
}

function countByStatus<T extends { status: string }>(items: T[], status: string): number {
  return items.filter((item) => item.status === status).length;
}

export const load: PageServerLoad = async ({ locals, cookies, parent, platform, url }) => {
  requireModule("payment", platform);
  requireModule("invoice", platform);
  requireModule("accounting-core", platform);
  requireModule("email", platform);
  requireModule("webhook-delivery", platform);
  const { activeOrgId } = await parent();
  if (!activeOrgId || !locals.user) throw redirect(303, "/app");

  const { permissions } = await requireOrgPermission(cookies, locals.user.id, activeOrgId, "org.read", locals.rbacStore);
  const ctx = authContext({ orgId: activeOrgId, actorId: locals.user.id, roles: permissions });
  const [invoicesResult, setupResult, endpointsResult, outboundDeliveriesResult, emailDeliveries] = await Promise.all([
    listInvoicesScoped(ctx, { limit: 500 }, { invoiceStore: locals.invoiceStore }),
    getAccountingSetupStatus({ tenantId: activeOrgId }, { accountingCoreStore: locals.accountingCoreStore }),
    listEndpoints({ endpointStore: locals.webhookEndpointStore }),
    listDeliveries({ limit: 25 }, { deliveryLog: locals.webhookDeliveryLog }),
    locals.emailRepository.listDeliveries({ limit: 10 })
  ]);

  const invoices = invoicesResult.ok ? invoicesResult.data.invoices : [];
  const setup = setupResult.ok ? setupResult.data.status : null;
  const endpoints = endpointsResult.ok ? endpointsResult.data.endpoints : [];
  const outboundDeliveries = outboundDeliveriesResult.ok ? outboundDeliveriesResult.data.deliveries : [];
  const openInvoices = invoices.filter((invoice) => invoice.status === "open");
  const linkedInvoices = invoices.filter((invoice) => Boolean(invoice.paymentLinkUrl));
  const providerBreakdown = Object.entries(
    linkedInvoices.reduce<Record<string, number>>((counts, invoice) => {
      const provider = invoice.paymentLinkProvider ?? "unknown";
      counts[provider] = (counts[provider] ?? 0) + 1;
      return counts;
    }, {})
  ).map(([provider, count]) => ({ provider, count }));
  const settings = setup?.settings ?? null;

  return {
    canManage: permissions.includes("*") || permissions.includes("member.manage"),
    providers: [
      getStripeProviderHealth(platform?.env, url, {
        stripeDepositAccountId: settings?.stripeDepositAccountId ?? null
      }),
      getEmailProviderHealth(platform?.env)
    ],
    stripe: {
      keyMode: keyMode(platform?.env?.STRIPE_SECRET_KEY),
      gatewayMode: platform?.env?.STRIPE_SECRET_KEY ? "stripe" : "memory",
      paymentLinkMode: platform?.env?.STRIPE_SECRET_KEY ? "stripe" : "memory",
      webhookConfigured: Boolean(platform?.env?.STRIPE_WEBHOOK_SECRET?.trim()),
      webhookUrl: new URL("/api/payments/stripe-webhook", url).toString(),
      acceptedEvents: ["checkout.session.completed", "payment_intent.succeeded"],
      requiredMetadata: "metadata.invoiceId"
    },
    paymentLinks: {
      totalInvoices: invoices.length,
      openInvoices: openInvoices.length,
      linkedInvoices: linkedInvoices.length,
      openWithoutLink: openInvoices.filter((invoice) => !invoice.paymentLinkUrl).length,
      latestCreatedAt: latestDate(invoices.map((invoice) => invoice.paymentLinkCreatedAt)),
      providerBreakdown
    },
    depositRouting: {
      stripeDepositConfigured: Boolean(settings?.stripeDepositAccountId),
      defaultDepositConfigured: Boolean(settings?.defaultDepositAccountId),
      status: settings?.stripeDepositAccountId ? "stripe deposit account" : settings?.defaultDepositAccountId ? "default deposit account" : "missing deposit account"
    },
    email: {
      providerId: locals.emailProvider.id,
      from: locals.emailFrom,
      providerConfigured: Boolean(platform?.env?.RESEND_API_KEY?.trim()),
      senderConfigured: Boolean(platform?.env?.EMAIL_FROM?.trim()),
      usesDefaultFrom: locals.emailFrom === "no-reply@example.com",
      recentCount: emailDeliveries.length,
      queued: countByStatus(emailDeliveries, "queued"),
      sent: countByStatus(emailDeliveries, "sent"),
      failed: countByStatus(emailDeliveries, "failed"),
      latestAt: latestDate(emailDeliveries.map((delivery) => delivery.createdAt))
    },
    outboundWebhooks: {
      endpointCount: endpoints.length,
      activeEndpointCount: endpoints.filter((endpoint) => endpoint.active).length,
      recentDeliveries: outboundDeliveries.length,
      failedDeliveries: countByStatus(outboundDeliveries, "failed"),
      latestAt: latestDate(outboundDeliveries.map((delivery) => delivery.createdAt))
    }
  };
};
