<script lang="ts">
  // Interactive wrapper for the webhook-delivery module. Auto-discovered by the
  // harness (wrappers/<module-id>.svelte). No live backend — the demo mirrors the
  // real use cases: registerEndpoint (url + event filter + per-endpoint secret),
  // deliverEvent (fans a domain event out to subscribed active endpoints, each
  // signed with its own secret → webhook.delivered / webhook.failed). One endpoint
  // is flaky to show a failed attempt with its status code.
  import Preview from "@microservices-sh/webhook-delivery/preview";

  let { module: m }: { module: any } = $props();

  // Domain events from across the install — the same names webhook-delivery consumes.
  const emitEvents = ["customer.created", "booking.confirmed", "payment.succeeded", "invoice.issued"];

  let eSeq = 3;
  let dSeq = 1;
  const secret = (n: number) => `whsec_${(n * 7919).toString(36)}k3y${n}`;
  let endpoints = $state<any[]>([
    { id: "ep_1", url: "https://api.partner.com/hooks/msh", eventNames: [], secret: secret(1), active: true },
    { id: "ep_2", url: "https://billing.acme.io/webhook", eventNames: ["payment.succeeded", "invoice.issued"], secret: secret(2), active: true },
    { id: "ep_3", url: "https://flaky.demo.dev/in", eventNames: [], secret: secret(3), active: true }
  ]);
  let deliveries = $state<any[]>([]);

  function onregister(input: { url: string; eventNames: string[] }) {
    // registerEndpoint — mints a per-endpoint signing secret
    const n = ++eSeq;
    endpoints = [...endpoints, { id: `ep_${n}`, url: input.url, eventNames: input.eventNames, secret: secret(n), active: true }];
  }
  function onemit(eventName: string) {
    // deliverEvent — fan out to subscribed, active endpoints, signed per endpoint.
    // The flaky endpoint returns 500 → webhook.failed; others 200 → webhook.delivered.
    const now = new Date().toISOString();
    const fresh = endpoints
      .filter((e) => e.active && (e.eventNames.length === 0 || e.eventNames.includes(eventName)))
      .map((e) => {
        const failed = e.url.includes("flaky");
        return { id: `del_${dSeq++}`, endpointUrl: e.url, eventName, status: failed ? "failed" : "delivered", statusCode: failed ? 500 : 200, error: failed ? "HTTP 500" : null, createdAt: now };
      });
    deliveries = [...fresh, ...deliveries];
  }
  function ontoggle(endpointId: string) {
    endpoints = endpoints.map((e) => (e.id === endpointId ? { ...e, active: !e.active } : e));
  }
</script>

<Preview {endpoints} {deliveries} {emitEvents} {onregister} {onemit} {ontoggle} />
