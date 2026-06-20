<script lang="ts">
  // Interactive wrapper for the invoice module. Auto-discovered by the harness
  // (wrappers/<module-id>.svelte). Invoice needs no live backend — the demo runs
  // client-side and mirrors the real use cases: createInvoice (draft lines),
  // issueInvoice (assigns the next gapless number + freezes → invoice.issued),
  // recordPayment (invoice.paid), voidInvoice (invoice.voided). Money math is the
  // module's own computeTotals, imported by the Preview.
  import Preview from "@microservices-sh/invoice/preview";
  import { computeTotals } from "@microservices-sh/invoice/totals";

  let { module: m }: { module: any } = $props();

  const series = "INV";
  const currency = "USD";
  const customerName = "Northwind Traders";

  let lineSeq = 1;
  let draftLines = $state([
    { id: `dl_${lineSeq++}`, description: "Implementation — Phase 1", quantity: 10, unitAmountCents: 15000, taxRateBps: 875 },
    { id: `dl_${lineSeq++}`, description: "Support retainer", quantity: 1, unitAmountCents: 50000, taxRateBps: 875 }
  ]);

  // one already-issued invoice so the lifecycle reads at a glance
  let invoices = $state<any[]>([
    { number: "INV-0001", customerName: "Globex Corp", status: "paid", currency, subtotalCents: 120000, taxCents: 10500, totalCents: 130500, lineCount: 2 }
  ]);

  function onaddline(l: { description: string; quantity: number; unitAmountCents: number; taxRateBps: number }) {
    draftLines = [...draftLines, { id: `dl_${lineSeq++}`, ...l }];
  }
  function onremoveline(id: string) {
    draftLines = draftLines.filter((l) => l.id !== id);
  }
  function onissue() {
    if (!draftLines.length) return;
    const t = computeTotals(draftLines); // per-line tax rounding, integer cents
    // gapless atomic number: next ordinal in the series — emits invoice.created + invoice.issued
    const number = `${series}-${String(invoices.length + 1).padStart(4, "0")}`;
    invoices = [
      { number, customerName, status: "open" as const, currency, subtotalCents: t.subtotalCents, taxCents: t.taxCents, totalCents: t.totalCents, lineCount: draftLines.length },
      ...invoices
    ];
    draftLines = []; // issued document is frozen; draft resets
  }
  function onpay(number: string) {
    // recordPayment → invoice.paid (full settlement in the demo)
    invoices = invoices.map((inv) => (inv.number === number ? { ...inv, status: "paid" as const } : inv));
  }
  function onvoid(number: string) {
    // voidInvoice → invoice.voided
    invoices = invoices.map((inv) => (inv.number === number ? { ...inv, status: "void" as const } : inv));
  }
</script>

<Preview {series} {currency} {customerName} {draftLines} {invoices} {onaddline} {onremoveline} {onissue} {onpay} {onvoid} />
