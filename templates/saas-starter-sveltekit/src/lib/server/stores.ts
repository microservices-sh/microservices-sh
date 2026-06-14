import { createD1RbacStore } from "@microservices-sh/org-team-rbac/adapters/d1";
import { createMemoryRbacStore } from "@microservices-sh/org-team-rbac/adapters/memory";
import { createD1BillingStore } from "@microservices-sh/billing-subscriptions/adapters/d1";
import { createMemoryBillingStore } from "@microservices-sh/billing-subscriptions/adapters/memory";
import { createD1TableGateway } from "@microservices-sh/admin-shell/adapters/d1";
import { createMemoryTableGateway } from "@microservices-sh/admin-shell/adapters/memory";
import { createD1AuditEventStore } from "@microservices-sh/audit-log/adapters/d1";
import { createMemoryAuditEventStore } from "@microservices-sh/audit-log/adapters/memory";
import { createD1SigningKeyStore } from "@microservices-sh/auth/adapters/d1";
import { createMemorySigningKeyStore } from "@microservices-sh/auth/adapters/memory";
import { createPlan } from "@microservices-sh/billing-subscriptions";
import type { RbacStore } from "@microservices-sh/org-team-rbac/ports";
import type { BillingStore } from "@microservices-sh/billing-subscriptions/ports";
import type { TableGateway } from "@microservices-sh/admin-shell/ports";
import type { AuditEventStore } from "@microservices-sh/audit-log/ports";
import type { SigningKeyStore } from "@microservices-sh/auth/ports";

// Memory singletons for local dev without D1. State persists across requests in
// a single dev session so signup → org → invite flows are coherent.
const memoryRbacStore = createMemoryRbacStore();
const memoryBillingStore = createMemoryBillingStore();
const memoryTableGateway = createMemoryTableGateway();
const memoryAuditStore = createMemoryAuditEventStore();
const memorySigningKeyStore = createMemorySigningKeyStore();

let plansSeeded = false;

// Seed a small demo plan catalog once, against whichever billing store is in
// play. Real installs create plans through an admin flow + Stripe price ids.
async function seedPlans(store: BillingStore): Promise<void> {
  if (plansSeeded) return;
  plansSeeded = true;
  const existing = await store.listPlans();
  if (existing.length > 0) return;
  await createPlan(
    { name: "Starter", priceCents: 0, currency: "USD", interval: "month", features: ["1 organization", "Up to 3 members", "Community support"] },
    { store }
  );
  await createPlan(
    { name: "Growth", priceCents: 4900, currency: "USD", interval: "month", features: ["Unlimited members", "Role-based access", "Email support"] },
    { store }
  );
  await createPlan(
    { name: "Scale", priceCents: 19900, currency: "USD", interval: "month", features: ["SSO-ready", "Audit log export", "Priority support"] },
    { store }
  );
}

export interface ServerStores {
  rbacStore: RbacStore;
  billingStore: BillingStore;
  tableGateway: TableGateway;
  auditStore: AuditEventStore;
  signingKeyStore: SigningKeyStore;
}

// The D1 binding as declared on App.Platform — referenced via the platform type
// so this file never depends on the bare `D1Database` ambient global.
type D1Binding = NonNullable<App.Platform["env"]>["DB"];

// Resolve the module stores for a request. D1-backed when the binding exists,
// memory-backed otherwise. The route layer only ever sees the port interfaces.
export async function resolveStores(db: D1Binding): Promise<ServerStores> {
  const billingStore = db ? createD1BillingStore(db) : memoryBillingStore;
  await seedPlans(billingStore);
  return {
    rbacStore: db ? createD1RbacStore(db) : memoryRbacStore,
    billingStore,
    tableGateway: db ? createD1TableGateway(db) : memoryTableGateway,
    auditStore: db ? createD1AuditEventStore(db) : memoryAuditStore,
    signingKeyStore: db ? createD1SigningKeyStore(db) : memorySigningKeyStore
  };
}
