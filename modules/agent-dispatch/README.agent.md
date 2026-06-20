# Agent Guide: Agent Dispatch Module

Read `module.json`, `llms.txt`, and `src/index.ts` before changing this module.

Rules:

1. Keep this module runtime-neutral. Do not import Fly, Vercel, Cloudflare
   Sandbox, or Hermes SDKs into the core use cases.
2. Workflow state belongs to `jobs-workflows`; this module stores only agent
   dispatch state, capability grants, and resume-token hashes.
3. Never store raw resume tokens. Return the token once from `dispatchAgentRun`
   and persist only its hash.
4. All reads and writes must be owner-scoped.
5. Capability grants must be short-lived and revoked when a run reaches a
   terminal state.
6. Tests must use memory stores and fake runtimes; no real executor I/O.
7. Risk `high`: migrations, runtime dispatch, secret brokering, and production
   deploy are approval-gated.
