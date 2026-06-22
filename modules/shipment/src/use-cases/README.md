# Shipment Use Cases

Add framework-neutral use cases here. Do not import SvelteKit, Hono, provider clients, or secret values directly in use cases.

`startShipmentProcessing` is the non-terminal fulfillment transition. `completeShipment` remains the only use case that may call the inventory deduction port.
