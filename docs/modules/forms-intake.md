# Forms & Intake

Status: available
Module ID: `forms-intake`
Mount: `/forms`

## Summary
Dynamic form builder and intake module with serializable field schemas, validation rules, conditional visibility, idempotent submissions, optional Turnstile spam protection, and attachment references.

## Dependencies
- none

Optional integrations:

- auth
- audit-log
- file-media
- jobs-workflows

## Permissions
- forms-intake.read
- forms-intake.write
- forms-intake.admin
- forms-intake.extend
- forms-intake.observe

## Secrets
- TURNSTILE_SECRET

Agents may inspect secret names and configured/missing status. They must not request or print secret values.

## Resources
- D1 (`DB`)

Tables:

- forms
- form_submissions

## RPC
- `createForm` with `forms-intake.write`
- `getForm` with `forms-intake.read`
- `updateForm` with `forms-intake.write`
- `listForms` with `forms-intake.read`
- `submitForm` public visitor intake
- `listSubmissions` with `forms-intake.read`
- `reviewSubmission` with `forms-intake.write`

## Hooks
- beforeFormPublish
- onSubmissionReceived

## Events
Emits:

- forms-intake.form_created
- forms-intake.form_updated
- forms-intake.submission_received
- forms-intake.submission_reviewed

Consumes:

- none

## Approval Gate
Risk: medium

Require explicit approval before:

- migrations
- PII fields
- production deploy behavior
- external side effects

## Update Notes
Config and hook changes are expected to stay upgradeable. Overlays and forks require manual or agent-assisted merge review.
