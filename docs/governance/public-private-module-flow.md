# Public/Private Module Flow

`microservices-sh/modules` is the public source and PR surface for module work. This private repo keeps pinned module snapshots so templates, create-app, and managed releases can build and test without depending on live network access.

## Public First

Use the public modules repo for:

- module proposals
- module implementation PRs
- provider adapters
- schemas, hooks, events, permissions, resources, migrations, and docs
- module CI and review

## Private Snapshot

Use this private repo for:

- importing accepted module snapshots
- composing modules into templates
- create-app bundling
- managed platform release tests
- private control-plane integration

Every private snapshot update should link the public modules commit, tag, or PR it imports.

## Do Not Publish

Do not move these into the public modules repo:

- hosted control-plane implementation
- deployment credentials
- billing/account logic
- private API keys or secrets
- production environment config
- customer data or production logs
- unreleased commercial roadmap
