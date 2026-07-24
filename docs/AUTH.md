## Accounts, Organizations, and Access Control

Phase 1 replaced the original no-login, browser-only BYOK model with real
accounts. This doc covers what changed and how to run it locally — see
[`ARCHITECTURE.md`](./ARCHITECTURE.md) for how this fits the rest of the app
and [`SECURITY.md`](./SECURITY.md) for the key-handling model this
supersedes.

## Model

- **Users** sign up with email/password (`lib/actions/auth.ts`), hashed with
  `bcryptjs` (`lib/crypto.ts`). Signup creates a new **organization** in the
  same transaction and makes the signer its `owner` (`createUserAndOrg` in
  `lib/db/queries.ts`).
- **Memberships** link a user to an organization with a role (`owner`,
  `admin`, `member`). A user can belong to more than one org (via invite
  acceptance). The sidebar **org switcher** updates the JWT active org via
  Auth.js `unstable_update` (`switchOrganizationAction`) after verifying
  membership. On sign-in, the session defaults to the earliest membership
  (`listMembershipsForUser` ordered by `created_at`).
- **`isPlatformAdmin`** on `users` is separate from any org role — it gates
  the `/admin` Superadmin console (Phase 3), and isn't set by any UI yet
  (there's no self-serve path to becoming a platform admin; set it directly
  in the database for the operator account).
- **Org-level BYOK**: one AI provider key per org+provider
  (`org_provider_keys`, encrypted with AES-256-GCM), set by an owner/admin
  under **Settings → Integrations** and shared by every member and every AI
  feature in that org. No API key is ever sent from or stored in the
  browser — `/api/orchestrate` resolves it server-side from the session's
  organization (see `app/api/orchestrate/route.ts`).
- **Invitations**: an owner/admin creates one from **Settings → Team**. When
  Resend is configured the invite is emailed; a copyable `/invite/<token>`
  link is always shown as fallback. Accepting while logged out prompts
  login/signup first, then completes the membership.
- **Password reset**: `/forgot-password` emails a one-hour
  `/reset-password/<token>` link (Resend). Tokens live in
  `password_reset_tokens` and are single-use. Responses never reveal whether
  the email is registered.
- **Audit log**: every privileged mutation (password change/reset, invite
  creation, org key set/delete, workspace rename, task edits, calendar
  disconnect, org switch, etc.) writes an `audit_log` row via
  `writeAuditLog`. Nothing ever updates or deletes a row there.
  Superadmin reads platform events at `/admin/audit`; tenants see
  org-scoped events under **Settings → Workspace**.

## Why Auth.js with no database adapter

Auth.js's database-session adapter doesn't support the Credentials provider
by design (it's a deliberate security constraint in Auth.js itself — a
database session implies a server-trusted, revocable session store, which
doesn't fit password-based sign-in the same way). Instead, `lib/auth.ts`
uses the **JWT** session strategy: `authorize()` looks up the user via
Drizzle and verifies the password with `bcryptjs`, and the `jwt`/`session`
callbacks embed `userId`, `isPlatformAdmin`, the active `organizationId`,
`organizationName`, and `role` into the token. This also sidesteps fighting
the adapter's fixed table shape — `lib/db/schema.ts`'s `users` table is
exactly what this app needs, nothing more.

## Route protection: `proxy.ts`, not `middleware.ts`

This repo pins a Next.js version (16.2.10) where the `middleware` file
convention was renamed to `proxy` — see `AGENTS.md` and
`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.
`middleware.ts` is silently ignored on this version; route protection lives
in `proxy.ts` (default-exported `auth((req) => {...})`, matching the
`export default function proxy(request) {...}` convention).

`proxy.ts` only performs optimistic, JWT-derived redirects (unauthenticated
→ `/login`, authenticated hitting auth pages → `/dashboard`,
non-platform-admin hitting `/admin` → `/dashboard`). Public auth pages
include `/login`, `/signup`, `/forgot-password`, and `/reset-password/*`.
Per Next's own auth guide, proxy/middleware is never the sole authorization
check — every server action and route handler re-verifies the session and
role itself (see `requireSession`/`requireAdmin` in `lib/actions/settings.ts`,
and the `auth()` calls in `app/api/orchestrate/route.ts` and
`app/api/knowledge/route.ts`).

## Local setup

```bash
cp .env.example .env.local
openssl rand -base64 32   # → AUTH_SECRET
openssl rand -base64 32   # → ENCRYPTION_KEY (different value)
npm run db:migrate        # or: npx drizzle-kit migrate
npm run dev
```

Visit `/signup` to create the first account/organization. To grant platform
admin (Superadmin console) access:

```bash
npm run admin:grant -- you@example.com
# revoke: npm run admin:grant -- you@example.com --revoke
```

Or set `is_platform_admin = true` on that user's row directly in Postgres.
There's no self-serve UI for this. After granting, **sign out and back in**
so the JWT picks up `isPlatformAdmin`, then open `/admin`.

See `docs/plans/ADMIN_PORTAL.md` for the Phase 3 console plan.

## Known gaps (Phase 1)

- ~~No org switcher~~ **done** — sidebar select when the user has 2+ memberships.
- ~~Invitations aren't emailed~~ **done** — `sendInvitationEmail` via Resend when
  `RESEND_API_KEY` + `EMAIL_FROM` are set (Settings → Team + Superadmin Add tenant).
  Copy-link fallback remains when email is skipped or fails.
- ~~No password reset flow~~ **done** — `/forgot-password` + `/reset-password/[token]`.
- ~~No rate limiting on login attempts~~ **done** — failed credentials are
  capped per IP (`LOGIN_IP_LIMIT`) and per email (`LOGIN_EMAIL_LIMIT`) over
  a 15-minute window in `lib/rate-limit.ts` / `loginAction`. Password-reset
  requests are similarly capped (`PASSWORD_RESET_*`).
- No dedicated integration test drives `signIn()`/`signOut()` end-to-end
  (Auth.js's Credentials flow expects Next's real request-scoped
  `cookies()`, which isn't available when calling route handlers directly
  in Vitest the way `tests/api/*.test.ts` does for the other routes).
  `tests/lib/queries.test.ts` covers the underlying data-access logic
  (`createUserAndOrg`, invitations, org provider keys, audit log, password
  reset tokens) against a real embedded Postgres instead.
- No server-side session store — Settings → Security explains JWT sessions
  honestly (no fake device list / revoke). Remote revoke, 2FA, and SSO
  enforcement remain backlog.
