# Phase 2 — remaining work

Phase 2 target (from `docs/ARCHITECTURE.md`): turn Agents / DevOps / Projects /
Meetings / Notifications from demo shells into real, org-scoped data.

## Status

| Area | Status | Notes |
|------|--------|--------|
| **Projects** | Done (core) | DB-backed list/board/tasks. Roadmap = honest empty (“not configured”). |
| **Agents** | Done | `agent_runs` + built-ins; custom org agents. |
| **DevOps** | Done | `deployments` / `incidents` + devops webhook. |
| **Meetings** | Done | Manual CRUD + Google / Microsoft Calendar OAuth. |
| **Notifications** | Done | Inbox, prefs, email/Slack, **GitHub + Jira webhooks** for Reviews/Mentions. |
| **Dashboard** | Done | Live KPIs from meetings, tasks, incidents, agent runs. |
| **Tracker → Kanban** | Done (one-way) | Optional `projectSlug` on GitHub/Jira webhooks upserts Issues → `project_tasks`. |
| **Knowledge Base** | Done | Org-scoped documents (`0013`); browse lists live docs; semantic search via org OpenAI key. |
| **Org audit UI** | Done | Settings → Workspace lists real `audit_log` rows for the active org. |
| **AI usage (Settings)** | Done | Profile page shows live `agent_runs` month/7d/success — no invented tokens. |
| **Connected services** | Done | Profile lists live BYOK / calendar / Slack / webhook ingest status. |
| **Tenant billing UI** | Done | Settings → Billing uses `planTier`, `mrrCents`, member count, Stripe invoices. |
| **Integrations catalog** | Done | Third-party grid is roadmap-only (Coming soon / Webhook ingest — no fake Connected). |
| **Security settings** | Done | Password is live; sessions/policy controls are honest (no fake devices or live toggles). |
| **Org API keys** | Done | `organization_api_keys` (`0014`); generate/list/revoke; Bearer on `/api/knowledge` + `/api/orchestrate`. |
| **Studio honesty** | Done | Code Review / Architecture / Proposal / Research: no demo seed rows; CTAs + optional `agent_runs`. |

## Parked (explicit — do not treat as open Phase 2 bugs)

| Item | Why parked |
|------|------------|
| Impersonation | High risk; deferred in ADMIN_PORTAL |
| Two-way Jira/GitHub + PR-as-task | Needs outbound API credentials + conflict rules |
| GitHub/Jira/Slack OAuth apps | Multi-day provider setup + token vault |
| Session store + remote revoke | Auth.js architecture change |
| 2FA / SSO enforce | Identity product; not a Settings toggle |
| Token metering / seat limits / Stripe Customer Portal | Billing product expansion |
| Background embed queue | Infra (Redis/worker) |
| Non-OpenAI embeddings | Schema dimension migration |
| Full on-call paging | Ops product beyond banners |
| Component + Playwright E2E | Separate testing investment |

## Migration

```bash
npm run db:migrate   # through 0014_organization_api_keys
```

### Review + Kanban webhooks

Notifications only:

```text
https://<host>/api/webhooks/github?organizationId=<org-uuid>
https://<host>/api/webhooks/jira?organizationId=<org-uuid>
```

Notifications + one-way Issues → board (project must exist):

```text
https://<host>/api/webhooks/github?organizationId=<org-uuid>&projectSlug=<slug>
https://<host>/api/webhooks/jira?organizationId=<org-uuid>&projectSlug=<slug>
```

```bash
GITHUB_WEBHOOK_SECRET=   # or reuse WEBHOOK_SECRET
JIRA_WEBHOOK_SECRET=     # or reuse WEBHOOK_SECRET
JIRA_BASE_URL=https://your-org.atlassian.net
```

### Org API keys

Owners/admins: Settings → Profile → API keys. Use:

```http
Authorization: Bearer nx_live_…
```

on `GET|POST /api/knowledge` and `POST /api/orchestrate` (session cookie still works).
