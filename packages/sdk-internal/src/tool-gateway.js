// Tool gateway — runtime governance for a generated tool manifest (Phase 2 of
// the agentic keystone; pairs with tool-codegen.js).
//
// Given a manifest plus injected dependencies (handlers, authorize, audit), it
// exposes listTools/callTool and enforces, in order:
//   1. scope gate     — non-public tools require the actor to hold the scope
//   2. approval gate  — mutations require explicit confirmation before running
//   3. execute        — dispatch to the module's handler (its use case)
//   4. audit          — append an append-only record of every outcome
//
// This is the governance core. An MCP/stdio or HTTP transport is a thin wrapper
// that maps tool-call requests onto callTool and supplies actor context. Pure
// and side-effect-free except through the injected `audit` sink.

const STATUS = {
  ok: 200,
  awaitingConfirmation: 202,
  forbidden: 403,
  unknownTool: 404,
  notWired: 501,
  handlerError: 500,
};

export function createToolGateway({ manifest, handlers, authorize, audit, now } = {}) {
  const tools = Array.isArray(manifest) ? manifest : [];
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  const clock = typeof now === "function" ? now : () => Date.now();

  async function recordAudit(tool, ctx, outcome, extra) {
    if (!audit || typeof audit.record !== "function") return;
    await audit.record({
      tool: tool.name,
      module: tool.module,
      method: tool.method,
      mutation: tool.mutation,
      actor: ctx?.actor ?? null,
      outcome,
      at: clock(),
      ...extra,
    });
  }

  // Tools the actor may see. Public tools are always listed; scoped tools only
  // when the actor's granted scopes include the tool's scope. With no scope
  // context, the full manifest is returned (discovery).
  function listTools(ctx) {
    if (!ctx || !Array.isArray(ctx.scopes)) return tools;
    return tools.filter((tool) => tool.public || ctx.scopes.includes(tool.scope));
  }

  async function callTool(name, input, ctx = {}) {
    const tool = byName.get(name);
    if (!tool) {
      return { ok: false, status: STATUS.unknownTool, error: { code: "UNKNOWN_TOOL", message: name } };
    }

    // 1. scope gate
    if (!tool.public) {
      const allowed = await authorize?.(ctx, tool.scope);
      if (!allowed) {
        await recordAudit(tool, ctx, "denied", { reason: "scope" });
        return { ok: false, status: STATUS.forbidden, error: { code: "FORBIDDEN", message: `requires scope ${tool.scope}` } };
      }
    }

    // 2. approval gate — a mutation runs only once the caller confirms.
    if (tool.requiresConfirmation && !ctx.confirmed) {
      await recordAudit(tool, ctx, "awaiting_confirmation", { input });
      return {
        ok: false,
        status: STATUS.awaitingConfirmation,
        awaitingConfirmation: true,
        tool: tool.name,
        error: { code: "CONFIRMATION_REQUIRED", message: `${tool.name} is a mutation — confirm to proceed.` },
      };
    }

    // 3. execute
    const handler = handlers?.[name];
    if (typeof handler !== "function") {
      return { ok: false, status: STATUS.notWired, error: { code: "NOT_WIRED", message: `${name} has no handler` } };
    }
    let result;
    try {
      result = await handler(input, ctx);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await recordAudit(tool, ctx, "error", { message });
      return { ok: false, status: STATUS.handlerError, error: { code: "HANDLER_ERROR", message } };
    }

    // 4. audit success
    await recordAudit(tool, ctx, "executed", { confirmed: Boolean(ctx.confirmed) });
    return { ok: true, status: STATUS.ok, data: result };
  }

  return { listTools, callTool };
}
