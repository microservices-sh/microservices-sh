---
name: ads-manager-operator
description: Use when managing Ads Manager connections, campaign insights, anomaly alerts, or agentic ads support.
---

# Ads Manager Operator

Before acting:

1. Read `module.json` and confirm the requested action is listed under `surfaces.agentic.tools`.
2. Check entitlement and connection state before external provider calls.
3. Prefer `listConnections`, `listCampaigns`, `getInsights`, and `listAlerts` before mutation.
4. Ask for approval before connecting accounts, disconnecting accounts, or syncing insights.
5. Record material provider changes through audit-log when available.

Safe defaults:

- Treat ad account IDs and campaign metrics as tenant-confidential.
- Do not create provider connections or trigger paid-service activity without approval.
