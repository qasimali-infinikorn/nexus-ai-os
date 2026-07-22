# Admin Portal Plan (Phase 3 — Superadmin)

Reference mockup: [`DESING/Nexus Superadmin.html`](../DESING/Nexus%20Superadmin.html)  
Auth gate: `users.is_platform_admin` → JWT `session.user.isPlatformAdmin` (already checked in `proxy.ts` for `/admin/*`).

This plan turns the Superadmin mockup into a real `/admin` console. **Phase 3.0
(shell + gate + Overview) is implemented**; later sections sequence Tenants,
flags, billing, and status so they can ship behind the existing platform-admin
flag without blocking the tenant app.

---

## 1. Goal

Give Nexus operators a **platform control plane** to:

- See health and revenue of the multi-tenant product
- Manage tenant orgs (search, filter, suspend, inspect)
- Toggle feature flags globally / by plan
- Inspect billing & MRR
- Watch system status / incidents
- Read an immutable audit trail of privileged actions

Tenant members never see this UI. Non–platform-admins hitting `/admin` already redirect to `/dashboard`.

---

## 2. Information architecture (from mockup)

| Nav id | Label | Mockup purpose |
|--------|--------|----------------|
| `overview` | Overview | KPI strip + Platform MRR chart + plan mix |
| `tenants` | Tenants (badge count) | Filterable org table (All / Active / Trial / Past due) + add tenant |
| `flags` | Feature Flags | Toggle capabilities (GA / Beta / Alpha) by audience |
| `billing` | Billing | Revenue KPIs + invoices / failed payments |
| `status` | System Status (incident badge) | Service health, agent runtime, queues |
| `audit` | Audit Log | Immutable privileged-action feed |

Shell notes from mockup:

- Dark-leaning operator chrome (reuse `[data-theme="dark"]` tokens or a dedicated `admin` theme)
- Narrow icon+label sidebar, sticky top bar with page title from view map
- Content max-width ~1280px (audit ~1080px), 24–28px page padding
- Enter animation: short fade/slide (`saUp` in mockup → reuse our `page-enter` / `reveal`)

---

## 3. Route map (proposed)

```text
app/(admin)/layout.tsx          # AdminShell; re-check isPlatformAdmin server-side
app/(admin)/admin/page.tsx                    → Overview
app/(admin)/admin/tenants/page.tsx
app/(admin)/admin/tenants/[orgId]/page.tsx    → Tenant detail (stretch)
app/(admin)/admin/flags/page.tsx
app/(admin)/admin/billing/page.tsx
app/(admin)/admin/status/page.tsx
app/(admin)/admin/audit/page.tsx
```

Optional later: `app/(admin)/admin/login` is **not** needed — platform admins use the same Auth.js session; only the flag differs.

Server actions live under `lib/actions/admin/*.ts` and **always** call a shared `requirePlatformAdmin()` helper (session + DB re-read of `is_platform_admin`), never trusting the JWT alone for mutations.

---

## 4. Data model additions

Existing today: `organizations`, `users`, `memberships`, `audit`-ish org activity, `is_platform_admin`.

Proposed tables (Drizzle migrations):

1. **`feature_flags`**
   - `key` (unique), `name`, `description`, `status` (`ga` | `beta` | `alpha`)
   - `audience` (`all` | `business_plus` | `enterprise` | `opt_in` | `tenant_list`)
   - `enabled` boolean, `updated_at`, `updated_by`

2. **`feature_flag_tenants`** (optional, for per-tenant overrides)
   - `flag_key`, `organization_id`, `enabled`

3. **`platform_audit_events`** → **implemented via `audit_log`**
   - Rows with `organization_id` null and `action` like `platform.tenant.*`
   - Append-only; no update/delete API
   - Avoids a duplicate table; org-scoped events still use the same table with an org id

4. **`tenant_billing_snapshot`** (or integrate Stripe later)
   - Phase 3a: demo/read models from org plan fields
   - Phase 3b: Stripe Customer / Subscription IDs on `organizations`

5. **`organizations` columns** (if missing)
   - `plan` (`team` | `business` | `enterprise`)
   - `status` (`active` | `trial` | `past_due` | `suspended`)
   - `trial_ends_at`, `mrr_cents` (cached) — or compute from billing provider

Mockup seed flags (parity with design):

- `ai-workspace`, `live-meetings`, `proposal-studio`, `byo-model`, `sso-scim`, `usage-billing`

---

## 5. Screen specs

### 5.1 Overview

- **KPIs** (4): e.g. Platform MRR, Active tenants, Agent runs (7d), Open incidents
- **Chart**: Platform MRR trailing 12 months (area) — can start with server-aggregated demo series, then real billing events
- **Plan mix**: donut/segments Enterprise / Business / Team
- Empty/error: honest empty if no orgs; never invent production $ without a source

### 5.2 Tenants

- Tabs: All · Active · Trial · Past due
- Table columns (mockup-driven): name, plan, seats, status, MRR, last active, actions
- Actions: view, suspend/restore, impersonate-support (**deferred** — high risk; design as Phase 3.2+)
- “Add tenant”: creates org + owner invite (reuses signup invitation flow)

### 5.3 Feature Flags

- List rows: key, title, description, status pill, audience, toggle
- Toggle writes `feature_flags` + `platform_audit_events`
- Tenant app reads flags via `getFeatureFlagsForOrg(orgId)` with edge cache later

### 5.4 Billing

- Stats: MRR, ARR, failed payments, trials converting
- Table of recent invoices / payment failures (Stripe webhook → DB in 3b)
- Phase 3a: read-only mock metrics gated behind `DEMO` or empty states

### 5.5 System Status

- Services: API, orchestrate workers, Postgres, embeddings, auth
- Manual incident banner + severity
- Badge on nav when any service ≠ healthy

### 5.6 Audit Log

- Infinite or paginated feed: actor, action, target, time
- Filter by action type
- Immutable; export CSV later

---

## 6. Security & compliance

- `requirePlatformAdmin()` on every admin server action and RSC page
- Dual check: JWT claim **and** fresh DB `is_platform_admin`
- All mutations → `platform_audit_events`
- No tenant data exports without audit
- Rate-limit admin mutations
- Document how to bootstrap the first platform admin (SQL / one-shot script) — already hinted in `docs/AUTH.md`
- Impersonation (if ever): separate “break-glass” flag, short TTL, forced audit, banner in tenant UI

---

## 7. Implementation phases

### Phase 3.0 — Shell & gate (1–2 days)

- [x] `app/(admin)/layout.tsx` + nav config mirroring mockup
- [x] Overview page with placeholder KPIs (empty/demo clearly labeled)
- [x] Harden `proxy.ts` + layout `requirePlatformAdmin`
- [x] Seed script: set `is_platform_admin` for a known user (`npm run admin:grant`)

Stub routes also exist for Tenants / Flags / Billing / Status / Audit (honest empty states).

### Phase 3.1 — Tenants + Audit (3–5 days)

- [x] Org list/filter from real `organizations` + membership counts
- [x] Status/plan columns + suspend action
- [x] Platform audit writer + Audit page reader

Platform audit events are stored in existing `audit_log` with `organization_id` null
(actions prefixed `platform.*`) rather than a separate `platform_audit_events` table.
Add-tenant creates an org + owner invite; impersonation remains deferred.

### Phase 3.2 — Feature flags (2–3 days)

- [x] Schema + admin toggles UI
- [x] Tenant app helper to gate routes/UI (start with 1–2 flags, e.g. `proposal-studio`)

Seeded keys: `ai-workspace`, `live-meetings`, `proposal-studio`, `byo-model`, `sso-scim`,
`usage-billing`. Nav + route layouts gate the first three; resolution is
`getFeatureFlagsForOrg` / `isFeatureEnabledForOrg` (audience + tenant overrides).

### Phase 3.3 — Billing & Status (3–5 days)

- [x] Billing KPIs from Stripe **or** explicit “not connected” empty state
- [x] System status page (health checks against `/api` + DB ping)
- [x] Nav badges for incidents / tenant count

Billing shows live plan mix + trial counts but never invents MRR. Status runs
`runPlatformHealthChecks()` (also exposed at public `GET /api/health`). Nav
badges: tenant count on Tenants; incident count on System Status when > 0.

### Phase 3.4 — Polish

- [ ] Match Superadmin visual density (dark default, KPI cards, charts)
- [ ] Loading skeletons (reuse `PageLoadingSkeleton`)
- [ ] Admin-only command palette entries

---

## 8. Out of scope (explicit)

- Self-serve “become platform admin”
- Full Stripe Customer Portal inside admin (link out is enough at first)
- Editing another user’s password
- Running arbitrary SQL / LLM as a tenant without consent

---

## 9. Success criteria

- [x] Platform admin can open `/admin` and see live tenant count from DB
- [x] Non-admin cannot open `/admin` (proxy + layout)
- [x] Flag toggle is audited and reflected for a test org within one request cycle
- [x] Mockup IA (6 nav items) is fully routed, even if Billing/Status start as honest empty states
- [x] Tenant list filters + suspend/restore write platform audit events

---

## 10. Open decisions

1. **Billing source**: Stripe from day one vs. manual plan fields until revenue is real?
   → **Decided for 3.3a**: honest empty $ KPIs; live plan_tier mix only. Stripe sync later.
2. **Impersonation**: ship in 3.1 or permanently defer?
3. **Admin theme**: force dark, or respect user theme toggle?

Resolve these before Phase 3.1 schema freeze.
