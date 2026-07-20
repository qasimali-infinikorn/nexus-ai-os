# API Reference

Both routes live under `app/api/` and run on the Node.js runtime. Neither
route requires authentication (see [`SECURITY.md`](./SECURITY.md)), but both
are rate-limited and validate their inputs — see the guardrail reference
table in `SECURITY.md` for exact limits, and `lib/rate-limit.ts` /
`lib/validation.ts` for the implementation.

A rate-limited request on either route returns `429` with a `Retry-After`
header (seconds) before any other processing happens.

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

Manages markdown/text files under `<repo>/knowledge/` (created on first
use) that back the Knowledge Base's keyword-search RAG context.

### `GET /api/knowledge`

Lists files in the knowledge directory.

```ts
// 200
{ success: true, files: { name: string; sizeBytes: number; updatedAt: string }[] }
// 500
{ success: false, error: string }
```

### `POST /api/knowledge`

Body is discriminated by `action`.

**`action: "add"`** — create or overwrite a file.

```ts
{ action: "add", name: string, content: string }
```
`name` is resolved via `resolveSafeKnowledgePath()` (`path.basename()` +
a `[^a-zA-Z0-9.-_]` → `_` character filter + a check that the resolved path's
parent is exactly the knowledge directory, rejecting `.`/`..`/empty names),
so it cannot escape the knowledge directory. `content` is capped at
`MAX_KNOWLEDGE_CONTENT_BYTES` (2 MB); oversized content returns `400`.

**`action: "delete"`** — remove a file.

```ts
{ action: "delete", name: string }
```
`name` goes through the same `resolveSafeKnowledgePath()` check without the
character-replacement step (so it can target any filename that already
exists verbatim inside `knowledge/`), still guaranteeing the resolved path
stays inside the knowledge directory.

**`action: "search"`** — keyword search across all files, used to build RAG
context before calling the `knowledge` agent via `/api/orchestrate`.

```ts
{ action: "search", query: string }   // capped at MAX_KNOWLEDGE_QUERY_LENGTH (500 chars)
// ->
{
  success: true,
  context: string;   // concatenated "--- DOCUMENT: <file> ---\n<content>" blocks, in relevance order
  matches: { filename: string; relevance: number; snippet: string }[];
}
```

Relevance is a simple sum of literal term-occurrence counts (query lowercased
and split on whitespace, terms >2 chars); files with zero term hits but
non-trivial content still get a token relevance score of `0.1` so they can
surface as low-confidence matches.

All three actions and `GET` return `{ success: false, error: string }` with
a `4xx`/`500` status on failure instead of throwing.
