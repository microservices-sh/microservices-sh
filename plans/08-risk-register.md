# Risk Register

## Product Risks
| Risk | Severity | Signal | Mitigation |
|------|----------|--------|------------|
| Too broad too early | High | many templates started, none complete | one template until paid beta gate |
| Users want no-code UI instead of agent workflow | Medium | requests focus on visual builder | reposition or choose no-code-adjacent segment later |
| Users do not trust third-party modules | High | users insist on hand-written code | make source, tests, contracts, and export central |
| "SaaS" framing excludes buyers | Medium | non-SaaS builders bounce | use production apps/business systems framing |
| Static boilerplate is enough | Medium | users only want repo download | offer export but validate subscription value through updates/deploys |

## Technical Risks
| Risk | Severity | Signal | Mitigation |
|------|----------|--------|------------|
| Managed Cloudflare cost runaway | High | previews/deploys create uncontrolled usage | plan limits, quotas, suspension, billing alerts |
| User code abuse | High | spam, crypto, scraping, malicious fetches | outbound policy, account verification, project limits, monitoring |
| Custom hooks break upgradeability | High | upgrades fail after customization | typed hooks, config-first customization, fork boundary |
| Deployment failures are hard for agents to fix | High | support tickets require human debugging | structured errors, remediation steps, logs tool |
| D1 schema/version drift | High | migrations fail across module versions | strict migration registry and pinned module versions |
| Secrets leakage | High | secrets appear in generated code or transcripts | scoped secrets, redaction, separate secret store |

## GTM Risks
| Risk | Severity | Signal | Mitigation |
|------|----------|--------|------------|
| Messaging sounds like generic boilerplate | High | low conversion, "how is this different?" | lead with agent-native contracts and managed Cloudflare |
| Developer communities reject promotion | Medium | negative launch comments | publish technical build logs and demos before selling |
| Agencies like idea but will not pay | High | calls but no paid pilots | ask for payment early and narrow to painful client use cases |
| Product Hunt traffic does not convert | Low | spike with no retained users | treat as launch amplifier, not validation |

## Operational Risks
| Risk | Severity | Signal | Mitigation |
|------|----------|--------|------------|
| Support burden exceeds team capacity | High | each app needs manual debugging | strict MVP scope, concierge limits, paid pilots only |
| Security expectations exceed maturity | High | enterprise asks before product is ready | defer enterprise, document current boundaries |
| Connector maintenance becomes a trap | Medium | many broken external integrations | only build connectors tied to paid workflows |

## Kill Criteria
Stop or pivot if:

- 30 qualified calls produce fewer than 3 paid pilot commitments.
- users strongly prefer static code export and will not pay for managed deploy/update value.
- the first template cannot be generated and deployed reliably after focused engineering.
- Cloudflare runtime economics do not support affordable managed projects.

## Risk Reduction Order
1. Validate pain and willingness to pay.
2. Prove agent can compose modules locally.
3. Prove managed preview deploy.
4. Prove one paid agency workflow.
5. Expand templates only after repeat use.
