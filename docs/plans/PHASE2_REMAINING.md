# Phase 2 — remaining work

Phase 2 target (from `docs/ARCHITECTURE.md`): turn Agents / DevOps / Projects /
Meetings / Notifications from demo shells into real, org-scoped data.

## Status

| Area | Status | Notes |
|------|--------|-------|
| **Projects** | Done (core) | DB-backed list/board/tasks. Roadmap = honest empty (“not configured”). |
| **Agents** | Done | `agent_runs` + built-ins; custom org agents. |
| **DevOps** | Done | `deployments` / `incidents` + devops webhook. |
| **Meetings** | Done | Manual CRUD + Google / Microsoft Calendar OAuth. |
| **Notifications** | Done | Inbox, prefs, email/Slack, **GitHub + Jira webhooks** for Reviews/Mentions. |
| **Dashboard** | Done | Live KPIs from meetings, tasks, incidents, agent runs. |
| **Tracker → Kanban** | Done (one-way) | Issues **and PRs** upsert when `projectSlug` is set. Outbound Nexus→tracker still parked. |
| **Knowledge Base** | Done | Org-scoped docs; large docs enqueue `embed_jobs` (`0015`); cron `POST /api/cron/embed-jobs`. |
| **Org audit UI** | Done | Settings → Workspace lists real `audit_log` rows. |
| **AI usage (Settings)** | Done | Live `agent_runs` stats — no invented tokens. |
| **Connected services** | Done | Live BYOK / calendar / Slack / webhook status. |
| **Tenant billing UI** | Done | Plan/MRR/invoices + **Stripe Customer Portal** + soft **seat caps** by plan. |
| **Integrations catalog** | Done | Roadmap-only honesty. |
| **Security settings** | Done | Password + **sign out everywhere else** via `users.session_version`. |
| **Org API keys** | Done | Generate/list/revoke; Bearer on knowledge/orchestrate. |
| **Studio honesty** | Done | Code Review / Architecture / Proposal / Research — no demo seed. |
| **PagerDuty (MVP)** | Done | Critical platform incidents page when `PAGERDUTY_ROUTING_KEY` is set. |
| **Playwright smoke** | Done | `e2e/smoke.spec.ts` (requires `E2E_EMAIL` / `E2E_PASSWORD`). |

## Still parked (need provider apps / product investment)

| Item | Why still parked |
|------|------------------|
| Impersonation | High risk; deferred in ADMIN_PORTAL (break-glass design only) |
| Two-way Jira/GitHub writes | Outbound API + conflict rules (inbound PR/Issues → board is live) |
| GitHub/Jira/Slack OAuth apps | Provider app registration + org token vault |
| Full Auth.js DB session store | Version bump covers remote revoke; device inventory still JWT-limited |
| 2FA / SSO enforce | Identity product (UI still “Coming soon”) |
| Token metering | Need provider usage capture on orchestrate |
| Non-OpenAI embeddings | Fixed 1536-dim column; prefer same-dim providers |
| Full on-call schedules | Events API page only — not schedules/escalation policies |
| Broad Playwright suite | Smoke only |

## Migration

```bash
npm run db:migrate   # through 0015_session_version_embed_jobs
```

### Embed job cron

```bash
CRON_SECRET=…
# POST /api/cron/embed-jobs?limit=5
# Authorization: Bearer $CRON_SECRET
```

### PagerDuty

```bash
PAGERDUTY_ROUTING_KEY=   # Events API v2 routing key; critical platform incidents only
```

### Org API keys

Owners/admins: Settings → Profile → API keys. Use `Authorization: Bearer nx_live_…`
on `/api/knowledge` and `/api/orchestrate`.
