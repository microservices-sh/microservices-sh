---
name: company-web-design
description: Turn company facts, brand assets, brochures, screenshots, old website copy, or messy product/service notes into a polished microservices.sh company landing page. Use with the `company-landing-astro` template, `intake.schema.json`, `content.schema.json`, `src/content.json`, logo/image assets, homepage copywriting, positioning, pricing copy, FAQs, contact details, and visual/brand adaptation.
---

# Company Web Design

Use this skill inside a `company-landing-astro` project, or when preparing input
for that template. The goal is to turn messy company information into validated
site content while preserving the template boundary.

## First Read

Read these files before editing:

- `microservices.template.json`
- `intake.schema.json`
- `content.schema.json`
- `src/content.json`
- `README.agent.md`
- `docs/llms.txt`

If the project has source assets, inspect filenames and dimensions before using
them. Do not assume the logo or hero image is licensed unless the user supplied
it for the site.

## Workflow

1. Extract the company facts: name, audience, offer, proof, contact details,
   location, pricing preference, brand color, logo, and useful images.
2. Ask only for missing required intake fields. Do not ask for every optional
   field if the provided material is enough to draft a credible site.
3. Map the intake into `src/content.json`, respecting `content.schema.json`
   lengths, fixed array counts, allowed icon keys, and exactly one featured plan.
4. Keep normal customization in `src/content.json`. Do not edit components,
   pages, layouts, or styles for copy-only work.
5. Copy approved assets into `public/` only when the template has a matching
   content field or the user explicitly asks for a layout/media enhancement.
6. Run `npm run validate`; run `npm run build` when dependencies are installed.

## Copy Rules

- Write concrete, business-specific copy. Avoid generic phrases like "innovative
  solutions" unless the source material uses them and there is no better detail.
- Make the hero headline short and memorable. Keep the combined title under
  about nine words.
- Convert product/service lists into three feature cards. If there are more than
  three offerings, group them by customer outcome.
- Use proof points for the logo strip, testimonial, hero note, or FAQ answers.
- Keep pricing honest. If prices are missing, use contact/scope language rather
  than inventing numbers.
- Make the primary CTA a real contact route when possible, usually `mailto:`.

## Visual Rules

- Use `theme.accent` for normal branding.
- Use `frontend-design` only when changing layout/components/visual system, not
  for routine content filling.
- Preserve static output: no SSR adapter, server routes, database, provider
  modules, or form backend unless the user explicitly approves a template/module
  migration.

## Finish Checklist

Report:

- Source materials used.
- Missing assumptions filled.
- Files changed.
- Validation/build result.
- Any assets not used and why.
