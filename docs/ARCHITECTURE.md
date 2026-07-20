# Architecture

Nexus AI Engineering OS is a single-page Next.js dashboard that routes a user's
prompt to one of several "specialist" LLM system prompts, optionally via a
"coordinator" agent that classifies the request first. There is no auth and
no server-side LLM-provider key storage — every `/api/orchestrate` request
carries the caller's own provider key. The Knowledge Base is the one feature
with real persistence, backed by Postgres.

## Stack

- **Next.js 16** (App Router, `runtime = "nodejs"` on API routes) + **React 19**
- No LLM SDKs — `lib/agents.ts` calls the OpenAI, Anthropic, and Gemini REST
  APIs directly with `fetch`
- **Postgres + pgvector**, via **Drizzle ORM** (`lib/db/`) — backs the
  Knowledge Base (documents, chunks, optional embeddings). Any Postgres with
  the `vector` extension works; Supabase is the reference target since it
  offers pgvector on its free tier. See "Knowledge Base" below and
  [`docs/DATABASE.md`](./DATABASE.md) for setup.
- Client state only for LLM provider keys: kept in `localStorage`
  (see `app/page.tsx`), never in a server session. Embedding-provider keys
  used by the Knowledge Base follow the same per-request BYOK model (see
  below) — nothing is stored server-side either way.

> This project pins a pre-release/experimental Next.js version (16.2.10) with
> conventions that may differ from stock Next.js docs — see `AGENTS.md` at the
> repo root before changing routing, config, or server/client boundaries.

## Request flow

```
components/*.tsx (client)
   │  fetch("/api/orchestrate", { provider, model, prompt, agentType, keys, context })
   ▼
app/api/orchestrate/route.ts
   │  picks AGENTS[agentType] system prompt from lib/agents.ts
   │  streams newline-delimited JSON status/result events back to the client
   ▼
lib/agents.ts: callLLM(provider, model, key, systemPrompt, userPrompt)
   │  raw fetch to api.openai.com / api.anthropic.com / generativelanguage.googleapis.com
   ▼
Provider API (key supplied by the browser on every request)
```

### Two orchestration modes

1. **Direct specialist** (`agentType !== "coordinator"`) — used by PR Reviewer,
   Architecture Studio, Proposal Creator, Research Digest, and Knowledge Base.
   The client already knows which specialist it wants; the route calls that
   specialist's system prompt once and streams the result back.

2. **Coordinator ("CEO") flow** (`agentType === "coordinator"`, used by the
   Command Center tab) — a three-step pipeline in
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
| `coordinator` | Command Center (CEO flow) |
| `eng_lead` | PR Reviewer |
| `architecture` | Architecture Studio |
| `proposal` | Proposal Creator |
| `research` | Research Digest |
| `documentation` | (defined, not yet wired to a UI tab) |
| `client_meeting` | (defined, not yet wired to a UI tab) |
| `knowledge` | Knowledge Base (RAG) |

## Knowledge Base / RAG (`app/api/knowledge/route.ts`)

Documents are rows in Postgres (`documents`, `document_chunks` —
`lib/db/schema.ts`), not files on disk. This replaced an earlier
filesystem-backed implementation that didn't work on Vercel (serverless
functions there have a read-only filesystem outside ephemeral `/tmp`,
confirmed live as `ENOENT: ... mkdir '/var/task/knowledge'`); Postgres has no
such constraint.

- `POST { action: "add", name, content }` upserts a `documents` row (unique
  on `name`), then re-chunks `content` via `lib/chunk.ts` (paragraph-aware,
  ~1000 chars/chunk) into `document_chunks`, replacing any previous chunks
  for that document.
- **Two search modes**, chosen per-request by whether the caller supplies
  an `embed: { provider: "openai", key }` field:
  - **No `embed`** (default, matches the original behavior): keyword search
    over whole-document `content` — literal (regex-escaped) term-occurrence
    counting, same relevance scoring as before.
  - **With `embed`**: semantic search. The query is embedded via
    `lib/embeddings.ts` (OpenAI `text-embedding-3-small`, 1536 dims) and
    matched against `document_chunks.embedding` using pgvector cosine
    distance (`drizzle-orm`'s `cosineDistance`), returning the closest
    chunks across all documents.
  - Chunks are stored with a `null` embedding when no `embed` key is given
    at write time — the keyword fallback still works over the full document
    content regardless, only semantic search needs embeddings to exist.
- **Not yet wired into the UI**: `components/knowledge-base.tsx` doesn't
  send `embed` today, so the dashboard always uses keyword search. Semantic
  search is available at the API level; surfacing an embedding-key input in
  the Knowledge Base tab is a follow-up, not done here.
- Requires `DATABASE_URL` to be set (see [`DATABASE.md`](./DATABASE.md)) —
  `getDb()` throws a clear error if it isn't, rather than the route crashing
  at import time.

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
  missing-key/non-ok-response errors), the rate limiter, and the validation
  helpers.
- `tests/api/` — both route handlers exercised directly (no dev server
  needed) via `next/server`'s `NextRequest`, with `fetch` mocked for
  provider/embedding calls. The knowledge route runs against a real embedded
  Postgres (`@electric-sql/pglite` + the `pgvector` extension via
  `@electric-sql/pglite-pgvector`, `tests/helpers/testDb.ts`) with the actual
  checked-in migrations applied — not a mocked DB layer. Covers the
  guardrails above plus a streamed NDJSON response
  (`tests/helpers/stream.ts` reads it back into events) for the
  direct-specialist path.

There is intentionally no component/UI test layer yet — `components/*.tsx`
and the dashboard's client-side streaming/localStorage logic are untested;
adding that would mean pulling in a DOM environment and a React testing
library, which is a separate decision from the API-layer harness added here.

## Known gaps / follow-ups

- No component/browser tests (see above).
- No authentication on either API route (see [`SECURITY.md`](./SECURITY.md)).
- Semantic search isn't wired into the Knowledge Base UI yet (API-only, see
  above).
- Only OpenAI embeddings are supported (`lib/embeddings.ts`); adding another
  provider means adding its dimension and a migration to match
  `EMBEDDING_DIMENSIONS` in `lib/db/schema.ts`.
- No background job/queue system — embedding generation happens inline in
  the request (synchronous), so a very large document's `add` call will be
  slow proportional to its chunk count.
