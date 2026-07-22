# Phase 2 — remaining work

Phase 2 target (from `docs/ARCHITECTURE.md`): turn Agents / DevOps / Projects /
Meetings / Notifications from demo shells into real, org-scoped data.

## Status

| Area | Status | Notes |
|------|--------|--------|
| **Projects** | Done (core) | DB-backed list/board/tasks. Roadmap/Jira sync still future. |
| **Agents** | Done | `agent_runs` persisted from `/api/orchestrate`; catalog + live stats. |
| **DevOps** | Done | `deployments` / `incidents` + `POST /api/webhooks/devops` (`WEBHOOK_SECRET`). |
| **Meetings** | Done (manual) | CRUD + agendas/action items. Calendar OAuth deferred. Prep via AI Workspace. |
| **Notifications** | Done | `notifications` inbox + mark-read; fan-out from agent runs / webhook incidents. |
| **Dashboard** | Done | Live KPIs from meetings, tasks, incidents, agent runs. |

## Remaining (optional / later)

- Google / Microsoft calendar OAuth for Meetings
- Richer notification prefs → delivery channels (email/Slack)
- Custom agent definitions (“New agent”)
- Jira / GitHub PR sync for Reviews notifications

## Migration

```bash
npm run db:migrate   # applies 0006_phase2_workspace
```
