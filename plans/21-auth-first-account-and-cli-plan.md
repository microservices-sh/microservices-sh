# Auth-First Account, CLI, And Admin Portal Plan

Generated: 2026-06-14

This plan adds real microservices.sh product authentication before billing. Billing needs a trusted user, workspace, and CLI identity model first; otherwise Stripe checkout cannot reliably map a paying customer to deploy entitlements.

## Current Status
The current implementation has a useful bootstrap, but not product auth:

- CLI supports `microservices auth login --api-key <key>`.
- CLI stores the key in `~/.microservices/config.json` with restrictive file permissions.
- CLI sends `Authorization: Bearer <key>` to API routes.
- API validates bearer tokens against static Worker env vars: `MICROSERVICES_API_KEY` and `MICROSERVICES_API_KEYS`.
- There are no user, workspace, session, API-key, invitation, or membership tables.
- There is no admin portal login yet.
- There is no revocation UI, workspace switcher, scoped key model, or billing identity.

This is enough for internal control-plane testing. It is not enough for self-serve users.

## Goal
Create the minimum production-grade auth foundation for:

1. Admin portal login.
2. Workspace ownership and membership.
3. Revocable CLI/MCP API keys.
4. Deployment-control authorization.
5. Billing identity and entitlement checks in the next phase.

The auth system should stay small. Users are expected to work mainly through CLI, MCP, Codex, Claude, Cursor, and generated source, not a large dashboard.

## Core Decision
Use different auth primitives for browser and CLI:

| Surface | Auth Primitive | Decision |
|---------|----------------|----------|
| Admin portal | Opaque, revocable server-side session token in secure HttpOnly cookie | Build first. |
| CLI | Workspace-scoped API key stored locally or in env vars | Build first. |
| Hosted MCP | Same workspace-scoped API key as CLI | Build first. |
| Browser/SPA API calls | Same secure session cookie, not localStorage tokens | Build first. |
| JWT | Only short-lived future access tokens if stateless calls become necessary | Defer. |
| OAuth/OIDC | Useful later for Google/GitHub/enterprise SSO | Defer. |

Do not make long-lived JWTs the main login model. Our use case needs revocation, workspace switching, API-key management, billing control, and CLI/agent access. Opaque D1-backed sessions and scoped API keys are simpler and safer for this stage.

## Product Auth Model
Identity entities:

- User: human account identified by verified email.
- Workspace: billable/deployable container.
- Workspace member: user role inside workspace.
- Session: browser/admin login.
- API key: CLI, MCP, CI, or agent credential scoped to a workspace.
- Invitation: future workspace membership invite.

Roles:

| Role | Permissions |
|------|-------------|
| owner | Billing, members, API keys, deploys, settings. |
| admin | API keys, deploys, usage, projects. No ownership transfer. |
| developer | Deploy, logs, resources. No billing or member management. |
| viewer | Read-only projects, usage, logs. |

For first release, implement `owner` and `admin`; keep `developer` and `viewer` reserved in schema and docs.

## D1 Schema
Add auth tables before billing tables.

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT,
  disabled_at TEXT
);

CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  owner_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  disabled_at TEXT,
  FOREIGN KEY (owner_user_id) REFERENCES users(id)
);

CREATE TABLE workspace_members (
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  removed_at TEXT,
  PRIMARY KEY (workspace_id, user_id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE auth_login_challenges (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  redirect_url TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  failed_attempts INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  workspace_id TEXT,
  session_hash TEXT NOT NULL UNIQUE,
  user_agent_hash TEXT,
  ip_prefix TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  created_by_user_id TEXT,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  scopes TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT,
  last_used_at TEXT,
  revoked_at TEXT,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

CREATE TABLE auth_device_codes (
  id TEXT PRIMARY KEY,
  user_code_hash TEXT NOT NULL UNIQUE,
  device_code_hash TEXT NOT NULL UNIQUE,
  workspace_id TEXT,
  requested_scopes TEXT NOT NULL,
  approved_api_key_id TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  approved_at TEXT,
  denied_at TEXT,
  last_polled_at TEXT
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT,
  actor_user_id TEXT,
  actor_api_key_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
```

Store hashes only for sessions, login codes, device codes, and API keys. Never store raw credentials after first display.

## API Routes
Add a dedicated auth module and route group.

Portal/session routes:

| Route | Purpose |
|-------|---------|
| `POST /auth/login/start` | Accept email, rate-limit, create OTP/magic-link challenge, send email. |
| `POST /auth/login/verify` | Verify challenge, create user if needed, create default workspace if needed, set session cookie. |
| `GET /auth/session` | Return current user, active workspace, role, and session metadata. |
| `POST /auth/logout` | Revoke current session and clear cookie. |
| `POST /auth/workspace/switch` | Set active workspace for current session. |

Workspace/account routes:

| Route | Purpose |
|-------|---------|
| `GET /account/me` | Current user and workspace context. |
| `GET /workspaces` | Workspaces visible to current user. |
| `POST /workspaces` | Create a workspace. |
| `GET /workspaces/:id/members` | List members. |

API-key routes:

| Route | Purpose |
|-------|---------|
| `GET /api-keys` | List keys for current workspace, showing prefix and metadata only. |
| `POST /api-keys` | Create a key and return raw key once. |
| `DELETE /api-keys/:id` | Revoke a key. |

Device-login routes for later:

| Route | Purpose |
|-------|---------|
| `POST /auth/device/start` | CLI starts browser/device login and receives user code plus verification URL. |
| `POST /auth/device/approve` | Portal approves a device login and issues a scoped API key. |
| `POST /auth/device/token` | CLI polls until approval, then receives the API key once. |

## Request Identity Middleware
Replace the current static `requireControlPlaneAuth` model with a real request identity.

Middleware outputs:

```ts
type RequestIdentity =
  | {
      kind: "session";
      userId: string;
      workspaceId: string;
      role: "owner" | "admin" | "developer" | "viewer";
    }
  | {
      kind: "api_key";
      apiKeyId: string;
      workspaceId: string;
      scopes: string[];
    }
  | {
      kind: "internal_static_key";
      scopes: string[];
    };
```

Auth helpers:

- `optionalAuth`
- `requireSession`
- `requireWorkspaceRole(role[])`
- `requireApiKeyScope(scope)`
- `requireControlPlaneAuth`
- `requireBillingAdmin`
- `requireInternalMetricsToken`

Keep `internal_static_key` temporarily so existing deploy tests and internal operations do not break during migration. Remove or restrict it after portal-created API keys are working.

## CLI Plan
Keep the current CLI auth command, but make the stored key real.

Phase 1 CLI commands:

```text
microservices auth login --api-key <key> [--api-url <url>] [--workspace <id>] [--json]
microservices auth status [--json]
microservices auth logout [--json]
microservices workspaces list [--json]
microservices workspaces switch <id> [--json]
microservices keys list [--json]
microservices keys create --name <name> [--scope deploy:write,logs:read] [--json]
microservices keys revoke <id> [--json]
```

Phase 2 CLI browser/device login:

```text
microservices auth login [--api-url <url>] [--json]
```

Flow:

1. CLI calls `POST /auth/device/start`.
2. CLI prints verification URL and user code.
3. User logs into admin portal and approves the device.
4. CLI polls `POST /auth/device/token`.
5. API returns one newly created workspace-scoped API key.
6. CLI saves it in the same config file path it uses today.

This gives a clean path for agents and humans: manual API-key paste first, browser login later.

CLI config shape:

```json
{
  "apiUrl": "https://api.microservices.sh",
  "workspaceId": "ws_...",
  "apiKey": "msh_live_...",
  "actor": "agent",
  "updatedAt": "2026-06-14T00:00:00.000Z"
}
```

Use env vars for CI and agents:

```text
MICROSERVICES_API_URL
MICROSERVICES_API_KEY
MICROSERVICES_WORKSPACE_ID
```

## Admin Portal Plan
Build only the auth/account pages needed before billing:

| Screen | Purpose |
|--------|---------|
| Login | Email OTP or magic-link login. |
| Workspace switcher | Pick active workspace. |
| API Keys | Create/revoke CLI and MCP keys. |
| Account | Email, session status, logout. |
| Team placeholder | Show owner/admin membership, invite later. |

Do not build billing pages in this phase. The auth-first exit gate is a logged-in user creating a scoped API key and using it from the CLI.

## Email Delivery
First implementation options:

1. Use existing Cloudflare Email Sending binding if configured.
2. Use a transactional provider later if Email Sending setup slows the first auth slice.
3. For internal development only, log OTP codes to deployment logs behind `AUTH_DEV_MODE=true`.

Never enable logged OTPs in production.

## Security Defaults
- Random unguessable IDs and tokens using Web Crypto.
- Hash session tokens, API keys, OTP codes, and device codes.
- Use an application secret/pepper for token hashing where appropriate.
- Constant-time compare for fixed-length hashes.
- API keys use a visible prefix and one-time raw-key display.
- Portal sessions use `Secure`, `HttpOnly`, `SameSite=Lax` cookies.
- Session lifetime: 30 days.
- OTP/magic-link lifetime: 10-15 minutes.
- Device-code lifetime: 10 minutes.
- Rate-limit login start, login verify, device polling, and API-key creation.
- Avoid account enumeration by returning generic login-start responses.
- CSRF protection for browser mutations.
- Audit key creation, key revocation, login, logout, workspace creation, and role changes.
- Do not log raw tokens, OTPs, session cookies, or API keys.

## Implementation Phases
### Phase A: Data Model And Auth Utilities
Duration: 1-2 days.

- Add D1 auth tables.
- Add token generation and hashing helpers.
- Add request identity types.
- Add static key fallback as `internal_static_key`.
- Add unit tests for hashing, redaction, expiry, and scope parsing.

Exit gate:

- D1 migration applies locally.
- Static auth still works for current control-plane tests.

### Phase B: D1 API Keys And Control-Plane Identity
Duration: 2-3 days.

- Add API-key create/list/revoke routes.
- Add D1 API-key lookup for `Authorization: Bearer`.
- Update `requireControlPlaneAuth` to accept D1 API keys.
- Add workspace context to deployments/projects where missing.
- Keep env-key fallback during rollout.

Exit gate:

- A D1-backed API key can run existing `deploy preview`, `deploy status`, and `deploy logs` commands.

### Phase C: Portal Login Sessions
Duration: 2-4 days.

- Add login start/verify/logout/session routes.
- Add email OTP or magic-link delivery.
- Add session cookie handling.
- Add minimal admin portal login and account shell.
- Add workspace switcher.

Exit gate:

- User can log in, see workspace, log out, and revoke session.

### Phase D: Admin API-Key Management And CLI Upgrade
Duration: 2-3 days.

- Add API Keys portal screen.
- Add CLI `workspaces` and `keys` commands.
- Update `auth status` to show workspace and scopes.
- Update CLI remediation text to point to portal key creation.

Exit gate:

- User creates a key in portal, runs `microservices auth login --api-key ...`, and can call control-plane routes.

### Phase E: Device Login
Duration: 2-3 days.

- Add device start/approve/token routes.
- Add CLI `auth login` browser/device flow.
- Store the issued API key in existing config format.

Exit gate:

- User can authenticate the CLI without manually copying a long API key.

### Phase F: Billing Readiness
Duration: 1 day.

- Add placeholder `billing_customer_id` or workspace billing join points only if needed.
- Add identity fields expected by the billing plan: `workspaceId`, `ownerUserId`, `ownerEmail`.
- Add authorization helpers for future `billing:read` and `billing:write` scopes.

Exit gate:

- Stripe checkout can be safely mapped to a workspace and owner in the next phase.

## File-Level Map
Likely implementation areas:

| Area | Files |
|------|-------|
| API schema | `api/schema.sql` |
| API auth module | `api/src/auth.ts` or `api/src/auth/*` |
| API route registration | `api/src/index.ts` |
| Control-plane auth integration | `api/src/control-plane.ts`, `api/src/mcp.ts` |
| CLI commands | `microservices-sh/packages/cli/src/index.js` |
| Admin portal | new app or static route, using the minimal portal moodboard direction |
| Docs | `README.md`, `plans/22-product-billing-cli-admin-portal.md` |

## Verification Plan
Automated:

- token generation/hash tests
- API-key prefix/redaction tests
- session expiry tests
- login challenge expiry and replay tests
- API-key route tests
- request identity middleware tests
- CLI `auth status/login/logout` smoke tests
- deploy route tests with static key and D1 API key during migration

Manual:

1. Seed or create first owner.
2. Start login by email.
3. Verify OTP/magic link.
4. Create workspace.
5. Create API key.
6. Log in with CLI key.
7. Run deploy status/preview smoke command.
8. Revoke key.
9. Confirm CLI calls fail.
10. Re-enable via new key.

## Rollout Plan
1. Ship schema and auth helpers with static-key fallback.
2. Seed first internal workspace and owner.
3. Create D1-backed API keys manually or through a temporary admin-only route.
4. Move internal CLI usage from env keys to D1 keys.
5. Launch minimal admin login and key management.
6. Remove static key from normal user docs.
7. Add billing only after workspace/session/API-key behavior is stable.

## Acceptance Criteria
Auth-first is complete when:

- The API can identify a request as session, D1 API key, or temporary internal static key.
- Portal login creates revocable sessions.
- A workspace owner can create and revoke CLI keys.
- CLI can authenticate with a workspace-scoped D1 key.
- Control-plane deploy routes receive workspace identity.
- Key revocation blocks further CLI access.
- Billing implementation has a reliable `workspaceId`, `ownerUserId`, and `ownerEmail` to attach Stripe customers and subscriptions.

## Sources Checked
- OWASP Authentication Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- OWASP Session Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- OAuth 2.0 Device Authorization Grant, RFC 8628: https://www.rfc-editor.org/rfc/rfc8628
