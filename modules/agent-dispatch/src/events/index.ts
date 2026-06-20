export const events = {
  emitted: [
    "agent_dispatch.dispatched",
    "agent_dispatch.waiting",
    "agent_dispatch.succeeded",
    "agent_dispatch.failed",
    "agent_dispatch.canceled"
  ],
  consumed: ["workflow.waiting"]
} as const;
