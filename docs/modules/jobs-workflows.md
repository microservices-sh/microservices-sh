# Jobs & Workflows

Status: available
Module ID: `jobs-workflows`
Mount: `/jobs`

## Summary
Durable background jobs and deterministic workflow runs for Cloudflare Workers
and D1. Supports idempotent enqueue, bounded retries, dead-letter handling,
catch-up schedules, waiting/resume gates, workflow artifacts, and step events.

## Dependencies
- none

Optional integrations:

- audit-log

## Permissions
- jobs.enqueue
- jobs.read
- jobs.admin
- workflows.define
- workflows.run
- workflows.read
- workflows.artifacts
- workflows.admin
- jobs-workflows.extend

## Secrets
- none

Agents may inspect secret names and configured/missing status. They must not request or print secret values.

## Resources
- D1 (`DB`)
- Queue (`JOBS_QUEUE`, optional)

Tables:

- jobs
- job_runs
- job_schedules
- workflow_definitions
- workflow_runs
- workflow_step_runs
- workflow_artifacts
- workflow_step_events

## Hooks
- beforeJobEnqueue
- computeBackoffMs
- onJobDead

## Events
Emits:

- job.enqueued
- job.succeeded
- job.retried
- job.dead
- job.scheduled
- workflow.defined
- workflow.started
- workflow.step.succeeded
- workflow.step.failed
- workflow.waiting
- workflow.succeeded
- workflow.failed
- workflow.artifact.recorded
- workflow.step.event_recorded

Consumes:

- none

## Approval Gate
Risk: high

Require explicit approval before:

- migrations
- background side effects
- production deploy behavior

## Update Notes
Config and hook changes are expected to stay upgradeable. Overlays and forks require manual or agent-assisted merge review.
