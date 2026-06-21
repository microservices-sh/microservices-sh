// MCP transport over the governed tool gateway (Phase 3 of the agentic keystone).
//
// Maps the Model Context Protocol tools surface onto createToolGateway:
//   tools/list  -> MCP tool definitions { name, description, inputSchema, _meta }
//   tools/call  -> gateway.callTool, with governance outcomes translated into MCP
//                  results: success becomes content; a scope denial or handler
//                  error becomes isError; the approval gate is surfaced via
//                  _meta.awaitingConfirmation so an MCP host can prompt and retry
//                  with a confirmed context.
//
// Pure and transport-agnostic. The stdio JSON-RPC loop (or an HTTP handler) is a
// thin wrapper that routes the MCP request envelope through handleRequest — see
// the superadmin-mcp server for the bootstrap shape. inputSchema comes from the
// app's per-tool schema map (generated from each module's zod export); when a
// tool has none, a permissive object schema is used (accepts any object).

const PERMISSIVE_SCHEMA = { type: "object", additionalProperties: true };

function jsonText(data) {
  if (typeof data === "string") return data;
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

export function createMcpToolServer({ gateway, schemas } = {}) {
  if (!gateway || typeof gateway.callTool !== "function" || typeof gateway.listTools !== "function") {
    throw new Error("createMcpToolServer: a tool gateway with listTools/callTool is required");
  }

  function toolDefinitions(ctx) {
    return gateway.listTools(ctx).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: schemas?.[tool.name] ?? PERMISSIVE_SCHEMA,
      // Governance hints so an MCP host can render the gate (badge a mutation,
      // pre-warn on confirmation) before the call round-trips.
      _meta: {
        scope: tool.scope,
        public: tool.public,
        mutation: tool.mutation,
        requiresConfirmation: tool.requiresConfirmation,
      },
    }));
  }

  async function callTool(name, args, ctx = {}) {
    const result = await gateway.callTool(name, args ?? {}, ctx);
    if (result.ok) {
      return { content: [{ type: "text", text: jsonText(result.data) }], isError: false };
    }

    const out = {
      content: [{ type: "text", text: result.error?.message ?? `Tool ${name} failed (${result.status}).` }],
      isError: true,
      _meta: { code: result.error?.code, status: result.status },
    };
    if (result.awaitingConfirmation) {
      out._meta.awaitingConfirmation = true;
      out._meta.tool = result.tool;
    }
    return out;
  }

  // Route an MCP JSON-RPC request (its params/result; the transport owns the
  // id/jsonrpc envelope). `ctx` carries the actor + granted scopes + confirmed.
  async function handleRequest(request, ctx = {}) {
    switch (request?.method) {
      case "tools/list":
        return { tools: toolDefinitions(ctx) };
      case "tools/call": {
        const params = request.params ?? {};
        return await callTool(params.name, params.arguments, ctx);
      }
      default:
        throw new Error(`createMcpToolServer: unsupported MCP method "${request?.method}"`);
    }
  }

  return { toolDefinitions, callTool, handleRequest };
}
