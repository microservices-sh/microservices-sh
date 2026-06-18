# Customer Reference UI

Reference UI is optional host-app code. The module owns customer records, lifecycle events, and extension hooks.

Admin surface:
- Search customers, view profiles, edit contact fields, and review notes or lifecycle state.
- Gate read views with `customer.read`; gate profile updates with `customer.write`.

Visitor surface:
- Show a customer profile or account settings surface when identity/session modules are installed.
- Use the visitor feature key `memberProfile`.

Agentic surface:
- Prefer lookup and summary operations before mutation.
- Require approval before creating, merging, deleting, exporting, or externally syncing customer records.
