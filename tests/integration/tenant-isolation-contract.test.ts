import { describe, it, expect } from "vitest";
// Relative imports on purpose: these operational modules aren't root-hoisted
// (nothing at the root depends on them), so importing by package name wouldn't
// resolve here. Relative paths keep this test dependency-free (no lockfile change)
// while still running the REAL module source.
import {
  createInvoice,
  createMemoryInvoiceStore,
  listInvoicesScoped,
  getInvoiceScoped,
  authContext
} from "../../modules/invoice/src/index";
import {
  createTicket,
  createMemoryTicketStore,
  listTicketsScoped,
  getTicketScoped
} from "../../modules/support-ticket/src/index";
import {
  createUploadTicket,
  completeUpload,
  createMemoryMediaStore,
  createMemoryObjectStorage,
  listFilesScoped,
  getFileScoped
} from "../../modules/file-media/src/index";
import {
  createForm,
  submitForm,
  createMemoryFormStore,
  listFormsScoped,
  listSubmissionsScoped
} from "../../modules/forms-intake/src/index";

// ───────────────────────────────────────────────────────────────────────────
// CONTRACT / E2E: tenant isolation across the COMPOSED operational surface.
//
// The per-module *.scope.test.ts files prove each module in isolation. This test
// proves the contract the whole app upholds: with the four operational modules
// composed over shared two-tenant stores (one deployment, one D1), an actor scoped
// to org A reads ZERO of org B's data through ANY module, and a foreign id is 404
// everywhere. Closes the contract/e2e leg of P0 #20.
// ───────────────────────────────────────────────────────────────────────────

const fixedNow = (ms: number) => () => ms;
const T0 = Date.parse("2026-01-01T00:00:00.000Z");
const A = "tenant-a";
const B = "tenant-b";

async function seedInvoice(store: ReturnType<typeof createMemoryInvoiceStore>, tenantId: string) {
  const r = await createInvoice(
    { tenantId, customerId: "cust-1", lineItems: [{ description: "svc", quantity: 1, unitAmountCents: 10_000, taxRateBps: 0 }] },
    { invoiceStore: store, now: fixedNow(T0) }
  );
  if (!r.ok) throw new Error("seed invoice failed");
  return r.data.id as string;
}

async function seedTicket(store: ReturnType<typeof createMemoryTicketStore>, tenantId: string) {
  const r = await createTicket(
    { tenantId, subject: "Help", description: "x", requesterEmail: "a@b.com" },
    { store, now: fixedNow(T0) }
  );
  if (!r.ok) throw new Error("seed ticket failed");
  return r.data.ticket.id;
}

async function seedFile(
  store: ReturnType<typeof createMemoryMediaStore>,
  storage: ReturnType<typeof createMemoryObjectStorage>,
  tenantId: string
) {
  const ticket = await createUploadTicket(
    { tenantId, originalName: "p.png", contentType: "image/png" },
    { mediaStore: store, now: fixedNow(T0) }
  );
  if (!ticket.ok) throw new Error("seed file ticket failed");
  const key = (ticket.data as { key: string }).key;
  const ticketId = (ticket.data as { ticketId: string }).ticketId;
  await storage.put(key, "bytes", { contentType: "image/png" });
  const done = await completeUpload({ ticketId, tenantId }, { mediaStore: store, storage, now: fixedNow(T0 + 1000) });
  if (!done.ok) throw new Error("seed file complete failed");
  return (done.data as { id: string }).id;
}

async function seedFormWithSubmission(store: ReturnType<typeof createMemoryFormStore>, tenantId: string) {
  const form = await createForm({ tenantId, name: "Intake" }, { formStore: store, now: fixedNow(T0) });
  if (!form.ok) throw new Error("seed form failed");
  const formId = (form.data as { id: string }).id;
  const sub = await submitForm({ formId, tenantId, values: {} }, { formStore: store, now: fixedNow(T0) });
  if (!sub.ok) throw new Error("seed submission failed");
  return { formId };
}

describe("CONTRACT — tenant isolation across the composed operational surface", () => {
  it("an actor scoped to org A reads zero of org B's data through any module, and foreign ids are 404 everywhere", async () => {
    // Shared stores — two tenants in one deployment.
    const invoiceStore = createMemoryInvoiceStore();
    const ticketStore = createMemoryTicketStore();
    const mediaStore = createMemoryMediaStore();
    const objectStorage = createMemoryObjectStorage();
    const formStore = createMemoryFormStore();

    // Seed both tenants across all four modules.
    const aInvoice = await seedInvoice(invoiceStore, A);
    const bInvoice = await seedInvoice(invoiceStore, B);
    const aTicket = await seedTicket(ticketStore, A);
    const bTicket = await seedTicket(ticketStore, B);
    const aFile = await seedFile(mediaStore, objectStorage, A);
    const bFile = await seedFile(mediaStore, objectStorage, B);
    await seedFormWithSubmission(formStore, A);
    const bForm = await seedFormWithSubmission(formStore, B);

    const ctxA = authContext({ orgId: A, actorId: "user-a" });

    // LISTS as A — every module returns only A's rows (even with forged B filters).
    const invoices = await listInvoicesScoped(ctxA, { tenantId: B }, { invoiceStore });
    const tickets = await listTicketsScoped(ctxA, { tenantId: B }, { store: ticketStore });
    const files = await listFilesScoped(ctxA, { tenantId: B }, { mediaStore });
    const forms = await listFormsScoped(ctxA, { tenantId: B }, { formStore });

    expect(invoices.ok && invoices.data.invoices.every((i) => i.tenantId === A)).toBe(true);
    expect(invoices.ok && invoices.data.invoices.length).toBe(1);
    expect(tickets.ok && tickets.data.tickets.every((t) => t.tenantId === A)).toBe(true);
    expect(tickets.ok && tickets.data.tickets.length).toBe(1);
    expect(files.ok && files.data.files.every((f) => f.tenantId === A)).toBe(true);
    expect(files.ok && files.data.files.length).toBe(1);
    expect(forms.ok && forms.data.forms.every((f) => f.tenantId === A)).toBe(true);
    expect(forms.ok && forms.data.forms.length).toBe(1);

    // FOREIGN IDS as A — 404/zero through every module (no existence disclosure).
    expect((await getInvoiceScoped(ctxA, bInvoice, { invoiceStore })).status).toBe(404);
    expect((await getTicketScoped(ctxA, { id: bTicket }, { store: ticketStore })).status).toBe(404);
    expect((await getFileScoped(ctxA, bFile, { mediaStore })).status).toBe(404);
    const bSubsAsA = await listSubmissionsScoped(ctxA, { formId: bForm.formId }, { formStore });
    expect(bSubsAsA.ok && bSubsAsA.data.count).toBe(0);

    // Sanity: A's OWN ids resolve, so the boundary isn't just refusing everything.
    expect((await getInvoiceScoped(ctxA, aInvoice, { invoiceStore })).ok).toBe(true);
    expect((await getTicketScoped(ctxA, { id: aTicket }, { store: ticketStore })).ok).toBe(true);
    expect((await getFileScoped(ctxA, aFile, { mediaStore })).ok).toBe(true);
  });

  it("a call with no session scope is refused (403) through every module", async () => {
    const noCtx = { orgId: "", actorId: "x", roles: [] } as never;
    expect((await listInvoicesScoped(noCtx, {}, { invoiceStore: createMemoryInvoiceStore() })).status).toBe(403);
    expect((await listTicketsScoped(noCtx, {}, { store: createMemoryTicketStore() })).status).toBe(403);
    expect((await listFilesScoped(noCtx, {}, { mediaStore: createMemoryMediaStore() })).status).toBe(403);
    expect((await listFormsScoped(noCtx, {}, { formStore: createMemoryFormStore() })).status).toBe(403);
  });
});
