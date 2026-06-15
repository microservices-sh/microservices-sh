// Cross-module hook dispatcher. A hook point's resolved chain is an ordered list
// of { kind: "filter"|"guard"|"observer", order, fn }. See Plan 25 §5.
//
//   filter   — receives input, returns (possibly mutated) input; chained.
//              throw => abort with HOOK_FAILED (filters are on the critical path).
//   guard    — returns { ok } | { ok:false, status, error }; ok:false vetoes the
//              operation (surfaced as-is). Cannot mutate input.
//   observer — fire-and-forget; return ignored; throw swallowed + op continues.
//
// Returns { ok: true, value } with the folded input, or { ok: false, status, error }.

export async function runHooks(point, input, ctx, chain) {
  const ordered = [...chain].sort((a, b) => a.order - b.order);
  let value = input;

  for (const hook of ordered) {
    if (hook.kind === "filter") {
      try {
        value = await hook.fn(value, ctx);
      } catch (e) {
        return {
          ok: false,
          status: 500,
          error: {
            code: "HOOK_FAILED",
            message: `Filter hook failed for ${point}`,
            cause: e instanceof Error ? e.message : String(e),
          },
        };
      }
    } else if (hook.kind === "guard") {
      const verdict = await hook.fn(value, ctx);
      if (verdict && verdict.ok === false) {
        return { ok: false, status: verdict.status ?? 403, error: verdict.error };
      }
    } else if (hook.kind === "observer") {
      try {
        await hook.fn(value, ctx);
      } catch (e) {
        // Observers cannot affect the operation; log and continue.
        console.error(`[connection-contract] observer hook error on ${point}:`, e);
      }
    } else {
      throw new Error(`Unknown hook kind "${hook.kind}" on ${point}`);
    }
  }

  return { ok: true, value };
}
