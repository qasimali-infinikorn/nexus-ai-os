# Architecture

Nexus AI Engineering OS is a multi-tenant Next.js app (real accounts, orgs,
and roles — see [`AUTH.md`](./AUTH.md)) that routes a user's prompt to one
of several "specialist" LLM system prompts, optionally via a "coordinator"
agent that classifies the request first. Every `/api/orchestrate` request
requires an authenticated session and resolves the caller's org's provider
key server-side (org-level BYOK, encrypted at rest) — no key ever touches
the browser. The Knowledge Base is the other feature with real persistence,
backed by the same Postgres database.

This is Phase 1 of a larger rebuild targeting the full IA in `DESING/`'s
mockups (a 13-section engineering workspace plus a separate Superadmin
console). Phase 1 covers accounts/orgs/roles, the new navigation shell, and
migrating the original 6 features into it; Projects/Agents/DevOps/
Meetings/Notifications are real routes with honest "coming soon" states
until Phase 2, and `/admin` (Superadmin) is Phase 3 — see
[`docs/plans/ADMIN_PORTAL.md`](./plans/ADMIN_PORTAL.md) for the
implementation plan derived from `DESING/Nexus Superadmin.html`. Phase 3
(shell through polish) is implemented; Stripe sync and impersonation remain backlog.
Per-tenant feature flag overrides are editable on `/admin/tenants/[orgId]`.

## Stack

- **Next.js 16** (App Router, `runtime = "nodejs"` on API routes) + **React 19**
- **Auth.js (NextAuth v5)**, Credentials provider, JWT sessions — see
  [`AUTH.md`](./AUTH.md) for the full model and why there's no database
  adapter. Route protection lives in `proxy.ts` — this Next.js version
  renamed `middleware.ts` to `proxy.ts`, see `AGENTS.md`.
- No LLM SDKs — `lib/agents.ts` calls the OpenAI, Anthropic, and Gemini REST
  APIs directly with `fetch`
- **Postgres + pgvector**, via **Drizzle ORM** (`lib/db/`) — backs accounts/
  orgs/memberships/org provider keys/invitations/audit log
  (`lib/db/queries.ts`) as well as the Knowledge Base (documents, chunks,
  optional embeddings). Any Postgres with the `vector` extension works;
  Supabase is the reference target since it offers pgvector on its free
  tier. See "Knowledge Base" below and [`docs/DATABASE.md`](./DATABASE.md)
  for setup.
- AI provider keys are **org-level BYOK**: one admin enters a key once
  under Settings → Integrations, encrypted at rest (`lib/crypto.ts`) and
  shared by every member of that org — never stored in the browser. A
  per-browser `localStorage` preference still exists, but only for
  *which* provider/model to call (`components/app-shell/provider-preference.ts`),
  not the secret itself. The Knowledge Base's optional embedding key
  (`embed: { provider, key }`) is a narrower exception — still per-request
  BYOK, not yet promoted to the org-level store (see below).

> This project pins a pre-release/experimental Next.js version (16.2.10) with
> conventions that may differ from stock Next.js docs — see `AGENTS.md` at the
> repo root before changing routing, config, or server/client boundaries.

## Request flow

```text
components/*.tsx (client, via components/app-shell/feature-panel-host.tsx)
   │  fetch("/api/orchestrate", { provider, model, prompt, agentType, context })
   ▼
app/api/orchestrate/route.ts
   │  requires an authenticated session (auth())
   │  resolves the org's provider key: getOrgProviderKey(session.organizationId, provider)
   │  picks AGENTS[agentType] system prompt from lib/agents.ts
   │  streams newline-delimited JSON status/result events back to the client
   ▼
lib/agents.ts: callLLM(provider, model, key, systemPrompt, userPrompt)
   │  raw fetch to api.openai.com / api.anthropic.com / generativelanguage.googleapis.com
   ▼
Provider API (key resolved server-side from the org's stored, encrypted key)
```

### Two orchestration modes

1. **Direct specialist** (`agentType !== "coordinator"`) — used by Code
   Review, Architecture, Proposal Studio, Research Center, and Knowledge
   Base. The client already knows which specialist it wants; the route
   calls that specialist's system prompt once and streams the result back.

2. **Coordinator ("CEO") flow** (`agentType === "coordinator"`, used by the
   AI Workspace page) — a three-step pipeline in
   `app/api/orchestrate/route.ts`:
   1. Classify the prompt with a routing system prompt to pick a specialist
      key (`eng_lead`, `architecture`, `proposal`, `research`,
      `documentation`, `client_meeting`, `knowledge`, or `none`).
   2. Run that specialist (if any) against the prompt/context.
   3. Synthesize a final executive-style response combining the specialist
      output (if any) with the coordinator's own system prompt.

Every step emits a `{"type": "status" | "agent_result" | "final_result" | "error", ...}`
JSON object as its own line over the response stream; see
[`API.md`](./API.md) for the full protocol.

## Agents (`lib/agents.ts`)

`AGENTS` is a static map of system prompts, not separate model instances —
"agents" here means "a system prompt + a name/role label," not autonomous
processes or tool-using loops. There is no tool use, memory, or multi-turn
state; each call is a single stateless system+user prompt round trip.

| Key | Used by |
|---|---|
| `coordinator` | AI Workspace (CEO flow) |
| `eng_lead` | Code Review |
| `architecture` | Architecture |
| `proposal` | Proposal Studio |
| `research` | Research Center |
| `documentation` | Documentation (`/documentation`) — README, ADR, API, runbook, etc. |
| `client_meeting` | Meetings page + AI Workspace prep links (Phase 2) |
| `knowledge` | Knowledge Base (RAG) |

## Knowledge Base / RAG (`app/api/knowledge/route.ts`)

Documents are **organization-scoped** rows in Postgres (`documents`,
`document_chunks` — `lib/db/schema.ts`), not files on disk. This replaced an
earlier filesystem-backed implementation that didn't work on Vercel
(serverless functions there have a read-only filesystem outside ephemeral
`/tmp`, confirmed live as `ENOENT: ... mkdir '/var/task/knowledge'`); Postgres
has no such constraint. Every list / add / delete / search filters on
`session.organizationId` — tenants never share a global document table.

- `POST { action: "add", name, content }` upserts a `documents` row (unique
  on `(organization_id, name)`), then re-chunks `content` via `lib/chunk.ts`
  (paragraph-aware, ~1000 chars/chunk) into `document_chunks`, replacing any
  previous chunks for that document.
- **Two search modes** (`mode: "keyword" | "semantic"`):
  - **Keyword** (default): term-occurrence counting over this org's
    whole-document `content` (regex-escaped).
  - **Semantic**: query embedded via `lib/embeddings.ts` (OpenAI
    `text-embedding-3-small`, 1536 dims) using the org OpenAI key from
    Settings → Integrations; matched against this org's
    `document_chunks.embedding` with pgvector cosine distance.
  - Chunks are stored with a `null` embedding when no org OpenAI key exists
    at write time — keyword search still works; semantic needs embeddings.
- Documents UI (`/documents`) exposes Keyword / Semantic toggle when
  `semanticAvailable` is true.
- Requires `DATABASE_URL` to be set (see [`DATABASE.md`](./DATABASE.md)) —
  `getDb()` throws a clear error if it isn't, rather than the route crashing
  at import time.

## Workspace pages & demo content (`lib/workspace/content.ts`)

The engineering pages (Dashboard, Projects, Code Review, DevOps, Agents,
Meetings, Notifications, Research Center, Proposal Studio, and the Knowledge
Base browse view) are built to the reference design in `DESING/` and render
from a **single typed content module**, `lib/workspace/content.ts`.

This is seed content for a demo workspace, not live telemetry. It is one
module rather than literals scattered across pages so that replacing it with
real sources is a contained change — each exported collection maps 1:1 to
the integration that will supersede it (`pullRequests` → GitHub,
`deployments`/`incidents` → CI + PagerDuty, `meetings` → Google/MS 365,
`researchItems` → the Research Assistant agent). Every screen that renders
it shows a `DemoNotice` banner (`components/workspace/ui.tsx`) so on-screen
numbers are never mistaken for production data.

The *real* features remain real and are reachable from those pages:
`/code-review/new`, `/architecture/design`, `/research-center/ask`,
`/proposal-studio/new`, and `/knowledge-base/manage` each host the original
agent panels and call `/api/orchestrate` (or `/api/knowledge`) with the
org's stored provider key.

Presentation is shared via `components/workspace/ui.tsx` (Card, Pill,
Avatar, Bar, DemoNotice) and `components/workspace/charts.tsx` —
dependency-free, server-rendered SVG (area, sparkline, grouped bars, donut,
service map), consistent with this repo's no-extra-dependencies posture.

### Type & theme

`app/globals.css` holds the design tokens. Type is **Inter** at the exact
scale measured from the mockup (body 13.5px, card title 14px, nav 13px,
section labels 12px, `h1` 24px, stat numbers 26px), exposed as `--fs-*`
variables. Every component color comes from a CSS variable, so the
`[data-theme="dark"]` block re-themes the whole app (used by the topbar
toggle, and by the Superadmin console in Phase 3) without touching
component CSS.

## Rendering

`components/markdown.tsx` is a small hand-rolled Markdown renderer (headers,
bold, lists, code blocks, blockquotes, inline code) built entirely from plain
React elements and text nodes — it never injects raw HTML into the DOM, so
LLM output cannot smuggle in arbitrary markup or scripts.

## Guardrails (`lib/rate-limit.ts`, `lib/validation.ts`)

Both API routes now validate their input and rate-limit before doing any
real work — see the guardrail table in [`SECURITY.md`](./SECURITY.md) for
exact limits. Validation failures on `/api/orchestrate` return a plain JSON
`400` *before* the response stream opens, so a client never has to parse a
partial NDJSON stream to find an error.

## Testing (`tests/`, Vitest)

`npm test` runs the Vitest suite (`vitest.config.ts`), scoped to the
server-side logic that doesn't require a browser:

- `tests/lib/` — `callLLM` (per-provider request shape, URL-encoding,
  missing-key/non-ok-response errors), the rate limiter, the validation
  helpers, `lib/crypto.ts` (encrypt/decrypt roundtrip, password hashing),
  and `lib/db/queries.ts` (accounts/orgs/memberships/org provider
  keys/invitations/audit log) against a real embedded Postgres.
- `tests/api/` — both route handlers exercised directly (no dev server
  needed) via `next/server`'s `NextRequest`, with `fetch` mocked for
  provider/embedding calls and `@/lib/auth`'s `auth()` mocked to a fixed
  session (see the comment in `tests/api/orchestrate.test.ts` for why —
  Auth.js's Credentials flow needs Next's real request-scoped `cookies()`,
  which isn't available calling route handlers directly). The knowledge
  route runs against a real embedded Postgres (`@electric-sql/pglite` +
  the `pgvector` extension via `@electric-sql/pglite-pgvector`,
  `tests/helpers/testDb.ts`) with the actual checked-in migrations applied
  — not a mocked DB layer. Covers the guardrails above plus a streamed
  NDJSON response (`tests/helpers/stream.ts` reads it back into events) for
  the direct-specialist path.

There is intentionally no component/UI test layer yet — `components/*.tsx`
and the dashboard's client-side streaming logic are untested; adding that
would mean pulling in a DOM environment and a React testing library, which
is a separate decision from the API-layer harness added here.

## Known gaps / follow-ups

- No component/browser tests (see above).
- No end-to-end test of the `signIn()`/`signOut()` flow itself (see
  [`AUTH.md`](./AUTH.md)'s "Known gaps" — covered indirectly via
  `tests/lib/queries.test.ts`).
- Semantic search is wired in the Knowledge Base Documents UI (Keyword /
  Semantic toggle). Embeddings use the org OpenAI key from Settings →
  Integrations; only OpenAI embeddings are supported (`lib/embeddings.ts`).
  Adding another provider means adding its dimension and a migration to match
  `EMBEDDING_DIMENSIONS` in `lib/db/schema.ts`.
- No background job/queue system — embedding generation happens inline in
  the request (synchronous), so a very large document's `add` call will be
  slow proportional to its chunk count.
- Agents / DevOps / Meetings / Notifications / Dashboard are DB-backed
  (Phase 2). Calendar OAuth and third-party review sync remain optional.
- Superadmin console at `/admin` (`isPlatformAdmin`-gated): tenants, flags, billing empty-state, health probes, audit.
