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
  incidentCount: number;
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
           | "research" | "documentation" | "client_meeting" | "knowledge";
  keys: { openai?: string; anthropic?: string; google?: string };
  context?: string;              // optional extra context (git diff, RAG snippets, etc.)
}
```

`keys[provider]` must be a non-empty string, `provider` must be one of the
three listed values, and `prompt`/`context`/`model` must stay within the
length limits in `SECURITY.md` — any of these failing returns a plain JSON
`400 { type: "error", message }` response *before* the stream opens (no
partial stream is started). Only a failure inside the stream itself (LLM
call errors, etc.) is reported as an `error` event on the stream.

### Response stream events

Each line is a JSON object with a `type`:

| `type` | Fields | Meaning |
|---|---|---|
| `status` | `message` | Human-readable progress update (routing, executing, synthesizing, warnings) |
| `agent_result` | `agent`, `content` | Output of a specific specialist (direct mode, or the routed specialist in coordinator mode) |
| `final_result` | `content` | The final answer to render — always the last successful event |
| `error` | `message` | Something failed; stream closes right after |

### Behavior by `agentType`

- **`agentType !== "coordinator"`** (direct specialist mode): calls
  `AGENTS[agentType]` once with `context` prepended to `prompt` if present,
  then sends one `agent_result` and one `final_result` with the same
  content.
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

Body is discriminated by `action`. `add` and `search` both accept an
optional `embed` field to opt into pgvector semantic search instead of
keyword search:

```ts
embed?: { provider: "openai", key: string }
```

**`action: "add"`** — create or overwrite a document by name.

```ts
{ action: "add", name: string, content: string, embed?: { provider: "openai", key: string } }
```
`name` is trimmed and capped at `MAX_KNOWLEDGE_NAME_LENGTH` (200 chars); it's
just a unique label now, not a filesystem path, so no character sanitization
is needed. `content` is capped at `MAX_KNOWLEDGE_CONTENT_BYTES` (2 MB);
oversized content returns `400`. Adding a `name` that already exists
replaces its content and re-chunks it from scratch (old chunks/embeddings
for that document are deleted first). If `embed` is supplied, each chunk's
embedding is computed via `lib/embeddings.ts` and stored; otherwise chunks
are stored with `embedding: null` (keyword search still works over the raw
`content`; semantic search does not, for chunks with no embedding).

**`action: "delete"`** — remove a document by name (cascades to its chunks).

```ts
{ action: "delete", name: string }
// 404 if no document with that name exists
```

**`action: "search"`** — used to build RAG context before calling the
`knowledge` agent via `/api/orchestrate`.

```ts
{ action: "search", query: string, embed?: { provider: "openai", key: string } }   // query capped at MAX_KNOWLEDGE_QUERY_LENGTH (500 chars)
// ->
{
  success: true,
  context: string;   // concatenated "--- DOCUMENT: <name> ---\n<content-or-chunk>" blocks, in relevance order
  matches: { filename: string; relevance: number; snippet: string }[];
}
```

- **Without `embed`** (default): keyword search over whole-document
  content — literal (regex-escaped) term-occurrence counting, same scoring
  as before this was backed by Postgres. `relevance` is a raw match count
  (or `0.1` for a non-empty document with zero term hits).
- **With `embed`**: semantic search. The query is embedded, then matched
  against chunk embeddings by pgvector cosine distance, top 10 closest
  chunks across all documents. `relevance` is `1 - cosine distance` (higher
  = more similar). Chunks with no stored embedding are excluded.

`components/knowledge-base.tsx` does not currently send `embed`, so the
dashboard UI only exercises the keyword-search path — semantic search is
available at the API level but not yet wired into a UI control.

All actions and `GET` return `{ success: false, error: string }` with a
`4xx`/`500` status on failure instead of throwing.
