<script lang="ts">
  // Interactive wrapper for the customer module. Auto-discovered by the harness
  // (wrappers/<module-id>.svelte). No live backend — the demo mirrors the real
  // upsertCustomer use case: keyed by email, a known email updates the record
  // (customer.updated) and a new one creates it (customer.created).
  import Preview from "@microservices-sh/customer/preview";

  let { module: m }: { module: any } = $props();

  let seq = 1;
  let customers = $state<any[]>([
    { id: `cu_${seq++}`, name: "Grace Hopper", email: "grace@navy.mil", phone: "+1 555 0101", notes: "Prefers email. Enterprise plan.", updatedAt: new Date(Date.now() - 864e5).toISOString() },
    { id: `cu_${seq++}`, name: "Ada Lovelace", email: "ada@analytical.co", phone: null, notes: null, updatedAt: new Date(Date.now() - 2 * 864e5).toISOString() },
    { id: `cu_${seq++}`, name: "Alan Turing", email: "alan@bletchley.uk", phone: "+44 20 7946 0000", notes: "Trial — follow up Friday.", updatedAt: new Date(Date.now() - 3 * 864e5).toISOString() }
  ]);

  function onsave(input: { name: string; email: string; phone: string | null; notes: string | null }) {
    const now = new Date().toISOString();
    const existing = customers.find((c) => c.email === input.email);
    if (existing) {
      // upsert hit → customer.updated
      customers = customers.map((c) => (c.email === input.email ? { ...c, ...input, updatedAt: now } : c));
    } else {
      // upsert miss → customer.created
      customers = [{ id: `cu_${seq++}`, ...input, updatedAt: now }, ...customers];
    }
  }
</script>

<Preview {customers} {onsave} />
