import { z } from "zod";

// Zod schema for the module.json `connections` block. See Plan 25 §6.
// All sections default to empty so a module declaring only some of them parses.

const rpcExpose = z.object({
  method: z.string().min(1),
  scope: z.string().nullable().optional(),
  public: z.boolean().default(false),
  input: z.string().optional(),
  output: z.string().optional(),
});

const rpcCall = z.object({
  target: z.string().min(1), // "<moduleId>.<method>"
  scope: z.string().nullable().optional(),
  input: z.string().optional(), // expected input schema ref; checked against the exposed method (rule 6)
});

const hookPoint = z.object({
  kind: z.enum(["filter", "guard", "observer"]),
  input: z.string().optional(),
  output: z.string().optional(),
  scope: z.string().nullable().optional(),
});

const providedHook = z.object({
  target: z.string().min(1), // "<moduleId>.<hookPoint>"
  handler: z.string().min(1),
  order: z.number().int().min(0),
});

export const connectionsSchema = z.object({
  requires: z.array(z.string().min(1)).default([]),
  optional: z.array(z.string().min(1)).default([]),
  rpc: z
    .object({
      exposes: z.array(rpcExpose).default([]),
      calls: z.array(rpcCall).default([]),
    })
    .default({ exposes: [], calls: [] }),
  events: z
    .object({
      emits: z.array(z.string().min(1)).default([]),
      consumes: z.array(z.string().min(1)).default([]),
    })
    .default({ emits: [], consumes: [] }),
  hookPoints: z.record(z.string(), hookPoint).default({}),
  provides: z
    .object({
      hooks: z.array(providedHook).default([]),
    })
    .default({ hooks: [] }),
});
