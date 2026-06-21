# HR People Ops Module Agent Guide

Use this module through `@microservices-sh/hr-people-ops`.

Safe first actions:

1. Read `module.json`.
2. Read `llms.txt`.
3. Inspect `src/index.ts` exports.
4. Run `pnpm --filter @microservices-sh/hr-people-ops check:spec`.
5. Run `pnpm --filter @microservices-sh/hr-people-ops build` after source edits.

Mutation rules:

- Create departments and positions before assigning employees to them.
- Assign leave balances before creating leave requests.
- Treat leave amounts as integer hundredths of a day.
- Approval moves pending leave to used leave; rejection and cancellation reverse the correct bucket.
- Keep payroll, benefits, tax, and auth-session behavior outside this module.
