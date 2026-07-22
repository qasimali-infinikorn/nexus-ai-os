# Phase 2 — remaining work

Phase 2 target (from `docs/ARCHITECTURE.md`): turn Agents / DevOps / Projects /
Meetings / Notifications from demo shells into real, org-scoped data.

## Status

| Area | Status | Notes |
|------|--------|--------|
| **Projects** | Done (core) | DB-backed list/board/tasks. Roadmap sync still future. |
| **Agents** | Done | `agent_runs` + built-ins; custom org agents. |
| **DevOps** | Done | `deployments` / `incidents` + devops webhook. |
| **Meetings** | Done | Manual CRUD + Google / Microsoft Calendar OAuth. |
| **Notifications** | Done | Inbox, prefs, email/Slack, **GitHub + Jira webhooks** for Reviews/Mentions. |
| **Dashboard** | Done | Live KPIs from meetings, tasks, incidents, agent runs. |

## Remaining (optional / later)

- Two-way Jira/GitHub sync into Projects / Code Review boards (webhooks today only fan out notifications)
- Admin backlog: Stripe MRR, ~~per-tenant flag UI~~, incident banners, impersonation

## Migration

```bash
npm run db:migrate   # through 0008_notification_delivery
```

### Review webhooks

Point GitHub / Jira at:

```text
https://<host>/api/webhooks/github?organizationId=<org-uuid>
https://<host>/api/webhooks/jira?organizationId=<org-uuid>
```

```bash
GITHUB_WEBHOOK_SECRET=   # or reuse WEBHOOK_SECRET
JIRA_WEBHOOK_SECRET=     # or reuse WEBHOOK_SECRET
JIRA_BASE_URL=https://your-org.atlassian.net
```
