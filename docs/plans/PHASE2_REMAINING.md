# Phase 2 — remaining work

Phase 2 target (from `docs/ARCHITECTURE.md`): turn Agents / DevOps / Projects /
Meetings / Notifications from demo shells into real, org-scoped data.

## Status

| Area | Status | Notes |
|------|--------|--------|
| **Projects** | Done (core) | DB-backed list/board/tasks. Roadmap/Jira sync still future. |
| **Agents** | Done | `agent_runs` + built-ins; **custom org agents** (`org_custom_agents`) run via orchestrate / AI Workspace. |
| **DevOps** | Done | `deployments` / `incidents` + `POST /api/webhooks/devops` (`WEBHOOK_SECRET`). |
| **Meetings** | Done | Manual CRUD + **Google Calendar OAuth** sync (14 days). Microsoft TBD. |
| **Notifications** | Done | Inbox + mark-read; fan-out honors **in-app prefs** (email/Slack delivery still TBD). |
| **Dashboard** | Done | Live KPIs from meetings, tasks, incidents, agent runs. |

## Remaining (optional / later)

- Microsoft calendar OAuth
- Email / Slack delivery for notification prefs (prefs matrix already stores channels)
- Jira / GitHub PR sync for Reviews notifications

## Migration

```bash
npm run db:migrate   # applies through 0007_calendar_agents_oauth
```

### Env (Google Calendar)

```bash
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
# optional override; default is {origin}/api/integrations/google-calendar/callback
GOOGLE_CALENDAR_REDIRECT_URI=
```

OAuth is **per-user + org**, separate from Auth.js login. Refresh tokens are
encrypted with `ENCRYPTION_KEY`.
