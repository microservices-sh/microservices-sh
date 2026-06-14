---
name: firebase-to-microservices
description: Migrate a Firebase application to a microservices.sh app on Cloudflare. Use when a user wants to move off Firebase (Firestore/Realtime Database, Firebase Auth, Cloud Storage, Cloud Functions, FCM) onto microservices.sh templates and modules backed by D1, R2, Durable Objects, and Workers. Covers source assessment, concept mapping, scaffolding, document-to-relational data migration into D1, auth cutover to email-code, and verification.
---

# Firebase → microservices.sh

## Overview

Use this skill to move an existing Firebase project onto a microservices.sh app running on Cloudflare. The target is a generated, user-owned app (D1 + KV + R2 + Workers, SvelteKit runtime) composed from published modules. The biggest shift is **document store → relational D1**: Firestore collections must be modeled as tables. Map concepts to modules first, scaffold, then move data.

This is plan-first and approval-gated. Migrating data, auth, and secrets crosses into the user's real users and records — never apply remote changes without explicit approval.

## Concept Mapping

| Firebase | microservices.sh target | Notes |
| --- | --- | --- |
| Firestore collections/documents | D1 tables via Drizzle | Denormalized docs → relational schema; biggest design task |
| Realtime Database (JSON tree) | D1, or Durable Objects for live state | Pick per access pattern |
| Security Rules | App/module permission checks at the Worker boundary | No DB-enforced rules in D1; enforce in code |
| Firebase Auth (email/password, phone, OAuth) | Platform email-code (passwordless) auth | Password/social/phone do not map 1:1 — confirm with user |
| Cloud Storage | R2 buckets | Update access/signed URL model |
| Cloud Functions (triggers, HTTPS) | Workers / module use-case files + hooks | Firestore triggers → module events/hooks |
| Scheduled Functions | Cloudflare Cron Triggers | |
| FCM push | External push provider via Worker | No native equivalent |
| Realtime listeners (`onSnapshot`) | Durable Objects + WebSocket | No drop-in; rebuild |

Flag non-1:1 surfaces (security rules, password/phone/OAuth auth, realtime listeners, FCM) to the user up front — these are the real migration cost, not the document copy.

## Workflow

### 1. Assess the source

- Enumerate Firestore collections, subcollections, and document shapes (Firestore is schemaless — sample documents to infer fields and types).
- Identify denormalized/duplicated data and document references that must become foreign keys.
- Export Security Rules per collection (these become Worker-side permission checks).
- Auth providers in use (email/password, phone, OAuth) and the user record shape.
- Cloud Storage buckets, Cloud Functions (triggers vs HTTPS), scheduled jobs, FCM usage.
- Approximate document counts per collection.

Report what maps cleanly vs what needs a rewrite before scaffolding.

### 2. Pick template and modules

```bash
pnpm create microservices-app@latest <app-name> --template <template-id>
cd <app-name>
pnpm install
pnpm microservices local setup
```

- Use a `customer`-backed template when documents model people/accounts.
- Add `email` for transactional mail (replaces Firebase auth emails).
- Add `payment-stripe` if the source app billed users.
- Confirm availability with `pnpm microservices modules list --json`; build missing surfaces as overlays, not by forking module internals.

If templates are not yet publicly released, say so and stop — do not invent a template id.

### 3. Model documents as relational schema

This is the core task. Firestore documents are denormalized; D1 is relational.

- Promote each collection to a table; promote subcollections to child tables with a foreign key to the parent.
- Split repeated/embedded arrays of objects into join tables.
- Convert Firestore types: `Timestamp`→`integer`(epoch) or `text`(ISO), `reference`→foreign key `text` id, `map`→`text`(JSON) or its own table, `array`→join table or `text`(JSON), `GeoPoint`→two columns.
- Recreate the access patterns as indexes; D1 does not enforce Security Rules.
- Where a module already owns an entity (customer, booking), extend via config/overlay rather than redefining it.

```bash
pnpm microservices check --json
```

### 4. Move the data

- Export Firestore (e.g. `gcloud firestore export`, or the Admin SDK to read collections).
- Transform documents to rows: flatten maps, resolve references to foreign keys, split arrays into child rows, convert timestamps.
- Load into **local** D1 first; verify counts per collection and that references resolve before any remote import.
- Remote D1 import is approval-gated — treat it like writing to production.

### 5. Cut over auth

- Platform auth is passwordless email-code. Firebase email/password, phone, and OAuth users cannot carry credentials over; plan a re-verification (users sign in by email code on first visit).
- Import Firebase user email + stable uid into the `customer`/users table so history links.
- Map Security Rules to explicit permission checks at the Worker boundary and in module hooks.
- Confirm the auth contract with the user before removing any Firebase login UI.

### 6. Storage, realtime, functions, push

- Copy Cloud Storage objects into R2; update access from Firebase URLs to R2 equivalents.
- Convert Firestore triggers to module events/hooks; convert HTTPS functions to Worker routes / use-case files.
- Rebuild `onSnapshot` realtime listeners as Durable Objects + WebSocket (`durable-objects` skill).
- FCM has no native equivalent — wire an external push provider from a Worker if needed.

### 7. Verify

```bash
pnpm dev
pnpm microservices local smoke
pnpm microservices check --json
```

Verify per-collection counts match, references resolve to valid foreign keys, auth login works via email code, and former Security Rules are enforced in code. Only after local verification, plan the approval-gated remote deploy and remote data import.

## Approval Gates

Ask for explicit approval before:

- Importing data into remote D1 or any production resource.
- Cutting over auth or invalidating existing user sessions.
- Copying user PII or Storage objects to R2.
- Provisioning Cloudflare resources, secrets, or deploying.
- Decommissioning the Firebase project (irreversible — confirm backups first).

Never ask the user to paste secret values into chat. Discuss secret names, scopes, and where to set them.

## Finish Checklist

Report:

- Which Firebase surfaces were mapped, which were rewritten, and which were dropped.
- Document→relational schema decisions (tables, child tables, join tables).
- Template/modules chosen and why.
- Data transforms applied and verified collection counts.
- Auth cutover plan and remaining user-facing steps (email re-verification).
- Approval-gated work planned but not executed (remote import, deploy, Firebase teardown).
