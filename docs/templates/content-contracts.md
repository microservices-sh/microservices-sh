# Template content contracts

A **content contract** makes a template's customer-facing content editable by an
AI agent (or a human) through a typed, validated data file — instead of hand-edited
component code. The agent that runs `create-microservices-app` collects the
customer's details and fills the contract; the template stays deterministic.

This is the convention every content-driven template follows. It is intentionally
the same across templates so an agent's workflow is identical everywhere.

## The five files

Each template that opts in ships these, all under the template root:

| File | Tracked? | Role |
| --- | --- | --- |
| `src/content.json` | source | **The data the agent edits.** All customer-facing copy (and, where wired, `theme.accent`). The shipped values are a valid, working example. |
| `content.schema.json` | source | **The contract.** JSON Schema (draft 2020-12) with types, length/array bounds, `enum`s, `x-hint` per field, and the `x-microservices` envelope. |
| `src/content.types.ts` | generated | `SiteContent` TypeScript type, **generated from the schema** so the type can never drift. Template code imports this. |
| `scripts/validate-content.mjs` | synced | Zero-dependency validator, **synced from the canonical copy**. Wired as `prebuild` so `npm run build` fails fast on contract violations. |
| `CLAUDE.md` | source | The agent playbook — auto-read by Claude Code when it opens the generated app. Explains what to edit, what not to, and how to verify. |

Generated/synced files (`content.types.ts`, `scripts/validate-content.mjs`) are
committed so the scaffolded app is standalone, but they are **not hand-edited** —
they are produced by the generator (below).

## The `x-microservices` envelope

The schema carries a top-level `x-microservices` object — the machine-readable
contract metadata an agent reads first:

```jsonc
"x-microservices": {
  "template": "company-landing-astro",        // template id
  "appliesTo": "src/content.json",             // the file the agent edits
  "verify": "npm run validate && npm run build", // how to confirm the result
  "doNotEdit": ["src/components/**", "src/layouts/**", "src/styles/**"],
  "scope": "home-page-only",                   // optional: what the contract covers
  "notes": "Where anything NOT in this contract lives (brand, theme, etc.)."
}
```

The envelope fields are identical across templates; only their values differ.

## The agent workflow

1. Open the scaffolded app → read `CLAUDE.md`.
2. Read `content.schema.json` — the contract, with `x-hint` guidance per field
   and the `x-microservices` envelope (write target, verify command, off-limits paths).
3. Edit `src/content.json` to the customer, staying within the schema (lengths,
   array bounds, enums). Mutate the example values; keep the structure.
4. Run the `verify` command. `npm run validate` gives fast, path-pointed errors
   (e.g. `hero.title: exceeds maxLength 60 (is 74)`) and also runs automatically
   before `npm run build`.

No LLM runs inside the CLI and there are no interactive prompts — the agent that
invokes the CLI is the one that collects and refines content.

## Adding a contract to a new template

1. Author `content.schema.json` at the template root (copy an existing one as a
   starting point; keep the `x-microservices` envelope).
2. Author `src/content.json` with valid example content.
3. Add `validate` + `prebuild` scripts to the template `package.json`:
   ```json
   "validate": "node scripts/validate-content.mjs",
   "prebuild": "node scripts/validate-content.mjs"
   ```
4. Generate the type + sync the validator:
   ```
   pnpm --filter create-microservices-app gen:template-types
   ```
   This scans every template for `content.schema.json` and, for each, writes
   `src/content.types.ts` and syncs `scripts/validate-content.mjs`.
5. Wire the template's components to read from `content.json` via the generated
   `SiteContent` type.
6. Add a `CLAUDE.md` playbook.

## Authoring gotcha: keep `$ref` bare

Do not put sibling keywords (`x-hint`, `description`, …) next to a `$ref`:

```jsonc
// ✗ defeats type generation — emits duplicate interfaces (Cta, Cta1, …)
"primaryCta": { "$ref": "#/$defs/cta", "x-hint": "..." }

// ✓ bare ref aliases cleanly to one interface
"primaryCta": { "$ref": "#/$defs/cta" }
```

A `$ref` with siblings is technically valid in draft 2020-12, but `json-schema-to-typescript`
(and many other tools) can't alias it, so it clones the target per use site. Put any
shared guidance in the `$defs` target's own `description`/`x-hint` instead.

## Single sources of truth

- **Shape** lives in `content.schema.json`. The TypeScript type is generated from
  it — never hand-write `content.types.ts`.
- **Validation logic** lives in `assets/validate-content.mjs` inside
  `create-microservices-app`. Templates carry synced copies — edit the canonical
  file and re-run `gen:template-types`.
- Re-run `gen:template-types` after editing any schema or the canonical validator.
