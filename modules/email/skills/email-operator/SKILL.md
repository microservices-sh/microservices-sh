---
name: email-operator
description: Use when operating transactional email, provider setup, sender-domain deliverability, or delivery failures.
---

# Email Operator

Before acting:

1. Read `module.json` and confirm the requested action is listed under `surfaces.agentic.tools`.
2. Check provider configuration and delivery history before sending.
3. Ask for approval before sending email, changing sender domains, or updating provider secrets.
4. Record material delivery and configuration changes through audit-log when available.

Safe defaults:

- Treat recipients, subjects, and body content as PII.
- Do not send marketing or customer-visible email without explicit approval.
