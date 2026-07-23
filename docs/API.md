# API Reference

Routes live under `app/api/` and run on the Node.js runtime. Orchestrate and
knowledge require an authenticated org session in the app; `/api/health` is
public for uptime probes. Orchestrate/knowledge are rate-limited and validate
inputs — see the guardrail table in `SECURITY.md`, and `lib/rate-limit.ts` /
`lib/validation.ts` for the implementation.

A rate-limited request returns `429` with a `Retry-After` header (seconds)
before any other processing happens.

## `GET /api/health`

Public liveness/readiness probe. Returns platform check results without
exposing secrets.

- **200** — every check is `healthy`
- **503** — one or more checks are `degraded` or `down`

```ts
{
  ok: boolean;
  checkedAt: string; // ISO
  incidentCount: number; // unhealthy probes + open platform banners
  probeIncidentCount: number;
  openBannerCount: number;
  checks: {
    id: string;
    name: string;
    status: "healthy" | "degraded" | "down";
    detail: string;
    latencyMs: number | null;
  }[];
}
```

Probes today: Postgres, Auth.js (`AUTH_SECRET`), encryption (`ENCRYPTION_KEY`),
Orchestrate API surface, Knowledge/embeddings readiness.

## `POST /api/webhooks/devops`

External CI / incident ingest. **No session** — authenticate with
`WEBHOOK_SECRET` (`Authorization: Bearer …` or `x-nexus-webhook-secret`).
Returns `503` if the secret is unset, `401` if it does not match (timing-safe),
`429` when rate-limited (60/min per client IP).

```ts
// Deployment
{ type: "deployment", organizationId: uuid, service, version,
  status: "success" | "failed" | "in_progress", detail?, externalId? }

// Incident
{ type: "incident", organizationId: uuid, code, title,
  severity: "critical" | "high" | "medium" | "low", summary?, externalId? }
```

Successful incident (and failed deploy) events also create inbox notifications.

## `POST /api/webhooks/github`

GitHub App / repository webhook for PR activity → **Reviews** / **Mentions**
notifications, plus optional one-way Issues → Kanban upsert.

- URL must include `?organizationId=<uuid>`
- Optional `&projectSlug=<slug>` — when set, `issues` events upsert a
  `project_tasks` row (`source=github`, `external_id=github:owner/repo#n`).
  Unknown slug → `404`. Without `projectSlug`, behavior is notifications-only.
- Auth: `X-Hub-Signature-256` HMAC-SHA256 of the raw body using
  `GITHUB_WEBHOOK_SECRET` (falls back to `WEBHOOK_SECRET`)
- Notification events: `pull_request` (opened / review_requested / closed),
  `pull_request_review` (submitted), PR/issue comments (`created`)
- Task sync events: `issues` (`opened` / `edited` / `reopened` / `closed` /
  `labeled` / `unlabeled` / `assigned`) — PRs are skipped
- `ping` is acknowledged with `{ ok: true, ignored: true }`
- Success body includes `notificationId` and/or `taskId` when applicable

## `POST /api/webhooks/jira`

Atlassian Jira webhook → **Reviews** (issue updates) / **Mentions** (comments),
plus optional one-way issue → Kanban upsert.

- URL must include `?organizationId=<uuid>`
- Optional `&projectSlug=<slug>` — when set, issue create/update upserts a
  `project_tasks` row (`source=jira`, `external_id=jira:KEY`). Comments stay
  notification-only. Unknown slug → `404`.
- Auth: `Authorization: Bearer …` or `x-nexus-webhook-secret` using
  `JIRA_WEBHOOK_SECRET` (falls back to `WEBHOOK_SECRET`)
- Optional `JIRA_BASE_URL` for browse links (`{base}/browse/KEY`)
- Success body includes `notificationId` and/or `taskId` when applicable

## `POST /api/webhooks/stripe`

Stripe → Superadmin billing: upserts `billing_invoices` and updates org
`mrr_cents` / subscription status. **No session** — verify
`Stripe-Signature` with `STRIPE_WEBHOOK_SECRET` (returns `503` if unset,
`401` on bad signature, `429` when rate-limited).

- Subscribe to `invoice.*` and `customer.subscription.*`
- Resolve org via Customer/subscription metadata `organizationId`, or a
  prior `organizations.stripe_customer_id` link (tenant detail form)
- Events that cannot resolve an org return `{ ok: true, ignored: true }`
- Dollar KPIs stay empty until real webhook data arrives — never invented

## `POST /api/orchestrate`

Streams newline-delimited JSON (one `JSON.stringify(event) + "\n"` per
line — **not** a compliant Server-Sent-Events body, despite the
`Content-Type: text/event-stream` response header) describing the
progress of an agent run.

### Request body

```ts
{
  provider: "openai" | "anthropic" | "google";
  model: string;                 // e.g. "gpt-4o", "claude-3-5-sonnet-20241022", "gemini-2.5-flash"
  prompt: string;
  agentType: "coordinator" | "eng_lead" | "architecture" | "proposal"
           | "research" | "documentation" | "client_meeting" | "knowledge"
           | string;             // also org custom keys like `custom_security_reviewer`
  context?: string;              // optional extra context (git diff, RAG snippets, etc.)
}
```

Provider API keys come from the org's encrypted BYOK store (Settings →
Integrations), not from the request body. `provider` must be one of the
three listed values, and `prompt`/`context`/`model` must stay within the
length limits in `SECURITY.md` — any of these failing returns a plain JSON
`400 { type: "error", message }` response *before* the stream opens (no
partial stream is started). Only a failure inside the stream itself (LLM
call errors, etc.) is reported as an `error` event on the stream.

Unknown `agentType` values are rejected unless they match an
`org_custom_agents.key` for the caller's organization.

### Response stream events

Each line is a JSON object with a `type`:

| `type` | Fields | Meaning |
|---|---|---|
| `status` | `message` | Human-readable progress update (routing, executing, synthesizing, warnings) |
| `agent_result` | `agent`, `content` | Output of a specific specialist (direct mode, or the routed specialist in coordinator mode) |
| `final_result` | `content` | The final answer to render — always the last successful event |
| `error` | `message` | Something failed; stream closes right after |

### Behavior by `agentType`

- **`agentType !== "coordinator"`** (direct specialist mode): resolves
  `AGENTS[agentType]` or an org custom agent, calls once with `context`
  prepended to `prompt` if present, then sends one `agent_result` and one
  `final_result` with the same content.
- **`agentType === "coordinator"`**: runs the 3-step CEO pipeline described
  in [`ARCHITECTURE.md`](./ARCHITECTURE.md) — classify → optionally run a
  specialist → synthesize. Only the synthesis step's output is sent as
  `final_result`.

If the LLM call inside a coordinator run fails, execution still continues
to the synthesis step (with a `status` warning) rather than aborting —
uncaught errors from the *outer* `try` (e.g. `JSON.parse` failure, unknown
`agentType` in direct mode) are caught once at the top level and emitted as
a single `error` event.

## `/api/knowledge`

Manages `documents`/`document_chunks` rows in Postgres (see
[`DATABASE.md`](./DATABASE.md)) that back the Knowledge Base. Requires
`DATABASE_URL` to be set — every handler returns `500` with a message
telling you so if it isn't, rather than crashing.

### `GET /api/knowledge`

Lists all documents.

```ts
// 200
{ success: true, files: { name: string; sizeBytes: number; updatedAt: string }[] }
// 500
{ success: false, error: string }
```

### `POST /api/knowledge`

Body is discriminated by `action`. Search accepts an optional `mode`; add
auto-embeds when the org has an OpenAI key configured in Settings →
Integrations (org BYOK — never send provider keys from the browser).

```ts
mode?: "keyword" | "semantic"   // search only; default "keyword"
embed?: false                   // add only; set false to skip embedding even if a key exists
```

**`action: "add"`** — create or overwrite a document by name.

```ts
{ action: "add", name: string, content: string, embed?: false }
```
`name` is trimmed and capped at `MAX_KNOWLEDGE_NAME_LENGTH` (200 chars); it's
just a unique label now, not a filesystem path, so no character sanitization
is needed. `content` is capped at `MAX_KNOWLEDGE_CONTENT_BYTES` (2 MB);
oversized content returns `400`. Adding a `name` that already exists
replaces its content and re-chunks it from scratch (old chunks/embeddings
for that document are deleted first). When the org has an OpenAI key, each
chunk is embedded via `lib/embeddings.ts` unless `embed: false`. Otherwise
chunks are stored with `embedding: null` (keyword search still works).

**`action: "delete"`** — remove a document by name (cascades to its chunks).

```ts
{ action: "delete", name: string }
// 404 if no document with that name exists
```

**`action: "search"`** — used to build RAG context before calling the
`knowledge` agent via `/api/orchestrate`.

```ts
{ action: "search", query: string, mode?: "keyword" | "semantic" }
// ->
{
  success: true,
  mode: "keyword" | "semantic",
  context: string;   // concatenated "--- DOCUMENT: <name> ---\n<content-or-chunk>" blocks
  matches: { filename: string; relevance: number; snippet: string }[];
}
```

- **`mode: "keyword"`** (default): literal term-occurrence counting over
  whole-document content. `relevance` is a raw match count (or `0.1` for a
  non-empty document with zero term hits).
- **`mode: "semantic"`**: embeds the query with the org OpenAI key, then
  ranks chunk embeddings by pgvector cosine distance (top 10). Returns
  `400` if no OpenAI key is configured. Chunks with no stored embedding are
  excluded.

`GET /api/knowledge` also returns `semanticAvailable: boolean` so the UI can
enable the Semantic toggle. The Documents page (`/knowledge-base/manage`)
exposes Keyword / Semantic retrieval controls.

All actions and `GET` return `{ success: false, error: string }` with a
`4xx`/`500` status on failure instead of throwing.

## Google / Microsoft Calendar OAuth

Per-user calendar connect (not Auth.js login). Requires session auth.

| Route | Purpose |
|-------|---------|
| `GET /api/integrations/google-calendar/start` | Redirects to Google consent (signed `state`) |
| `GET /api/integrations/google-calendar/callback` | Exchanges code, stores encrypted refresh token, syncs 14 days of events into `meetings` |
| `GET /api/integrations/microsoft-calendar/start` | Redirects to Microsoft consent |
| `GET /api/integrations/microsoft-calendar/callback` | Same flow via Microsoft Graph `calendarView` |

Env: `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (optional `GOOGLE_CALENDAR_REDIRECT_URI`);
`MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` (optional `MICROSOFT_CALENDAR_REDIRECT_URI`).
