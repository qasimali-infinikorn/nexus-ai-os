# Phase 2 — remaining work

Phase 2 target (from `docs/ARCHITECTURE.md`): turn Agents / DevOps / Projects /
Meetings / Notifications from demo shells into real, org-scoped data.

## Status

| Area | Status | Notes |
|------|--------|--------|
| **Projects** | Done (core) | DB-backed list/board/tasks. Roadmap/Jira sync still future. |
| **Agents** | Done | `agent_runs` + built-ins; **custom org agents** (`org_custom_agents`) run via orchestrate / AI Workspace. |
| **DevOps** | Done | `deployments` / `incidents` + `POST /api/webhooks/devops` (`WEBHOOK_SECRET`). |
| **Meetings** | Done | Manual CRUD + **Google** and **Microsoft** Calendar OAuth sync (14 days). |
| **Notifications** | Done | Inbox + mark-read; in-app prefs; **email (Resend)** + **Slack webhook** delivery. |
| **Dashboard** | Done | Live KPIs from meetings, tasks, incidents, agent runs. |

## Remaining (optional / later)

- Jira / GitHub PR sync for Reviews notifications

## Migration

```bash
npm run db:migrate   # through 0008_notification_delivery
```

### Env

```bash
# Calendars (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=

# Email notifications (Resend)
RESEND_API_KEY=
EMAIL_FROM="Nexus <notify@yourdomain.com>"
APP_URL=https://your-app.example   # links in email/Slack

# Slack: per-user incoming webhook under Settings → Notifications
```
