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
| **Notifications** | Done | Inbox + mark-read; fan-out honors **in-app prefs** (email/Slack delivery still TBD). |
| **Dashboard** | Done | Live KPIs from meetings, tasks, incidents, agent runs. |

## Remaining (optional / later)

- Email / Slack delivery for notification prefs (prefs matrix already stores channels)
- Jira / GitHub PR sync for Reviews notifications

## Migration

```bash
npm run db:migrate   # loads .env.local; applies through 0007_calendar_agents_oauth
```

### Env (calendars)

```bash
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALENDAR_REDIRECT_URI=   # optional

MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_CALENDAR_REDIRECT_URI=   # optional; default {origin}/api/integrations/microsoft-calendar/callback
```

OAuth is **per-user + org**, separate from Auth.js login. Refresh tokens are
encrypted with `ENCRYPTION_KEY`.
