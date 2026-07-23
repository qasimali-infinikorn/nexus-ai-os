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
| **Tracker → Kanban** | Done (one-way) | Optional `projectSlug` on GitHub/Jira webhooks upserts Issues → `project_tasks`. |

## Remaining (optional / later)

- Two-way Jira/GitHub sync (Nexus → tracker) and PR-as-task
- Admin backlog: ~~Stripe MRR~~, ~~per-tenant flag UI~~, ~~incident banners~~, impersonation (deferred)
- Auth gaps: ~~login rate limit~~, ~~invite email~~, ~~password reset~~, ~~org switcher~~

## Migration

```bash
npm run db:migrate   # through 0012_project_task_external
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
