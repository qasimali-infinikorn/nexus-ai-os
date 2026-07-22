# Phase 2 — remaining work

Phase 2 target (from `docs/ARCHITECTURE.md`): turn Agents / DevOps / Projects /
Meetings / Notifications from demo shells into real, org-scoped data.

## Status

| Area | Status | Notes |
|------|--------|--------|
| **Projects** | Partially done | DB-backed list/board/tasks (`projects`, migrations 0002–0004). Still demo for roadmap summary / Jira sync. |
| **Agents** | Demo UI | Catalog + Run links to real specialists; run counts / “New agent” not persisted. |
| **DevOps** | Demo UI | Needs CI / incident integrations (GitHub Actions, PagerDuty, etc.). |
| **Meetings** | Demo UI | Needs calendar sync; `client_meeting` agent exists but isn’t a full prep flow. |
| **Notifications** | Demo UI | Needs real event fan-out (mentions, reviews, incidents); mark-read is inert. |
| **Dashboard** | Demo widgets | Still seeded from `lib/workspace/content.ts` with `DemoNotice`. |

## Remaining (suggested order)

1. Notifications — persist inbox events from org activity / agent runs  
2. Meetings — calendar OAuth + prep via `client_meeting` agent  
3. Agents — run history table + wire “New agent” or drop the fake CTA  
4. DevOps — webhook ingest for deploys/incidents  
5. Dashboard — replace demo KPIs with aggregates from the above  

Phase 3 (Superadmin) can proceed in parallel; it does not block these items.
