# Architecture

Nexus AI Engineering OS is a single-page Next.js dashboard that routes a user's
prompt to one of several "specialist" LLM system prompts, optionally via a
"coordinator" agent that classifies the request first. There is no database,
no auth, and no server-side API key storage — every request carries the
caller's own provider key.

## Stack

- **Next.js 16** (App Router, `runtime = "nodejs"` on API routes) + **React 19**
- No LLM SDKs — `lib/agents.ts` calls the OpenAI, Anthropic, and Gemini REST
  APIs directly with `fetch`
- No database — the "Knowledge Base" feature persists markdown/text files to
  a `knowledge/` directory on the server's local filesystem
- Client state only: API keys, provider, and model are kept in
  `localStorage` (see `app/page.tsx`), never in a server session

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

This is keyword search, not vector/embedding search:

- Files live under `<repo>/knowledge/*` on disk.
- `POST { action: "search", query }` splits the query into terms, counts
  literal (now regex-escaped) occurrences of each term per file, ranks files
  by score, and concatenates all matching file contents into one `context`
  blob.
- That `context` blob is sent as-is to the `knowledge` specialist prompt —
  there's no chunking, size limit, or embedding step, so large knowledge
  files can blow past a model's context window.

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
  provider calls and `process.cwd()` swapped to a temp dir for the knowledge
  route's filesystem writes. Covers the guardrails above plus a streamed
  NDJSON response (`tests/helpers/stream.ts` reads it back into events) for
  the direct-specialist path.

There is intentionally no component/UI test layer yet — `components/*.tsx`
and the dashboard's client-side streaming/localStorage logic are untested;
adding that would mean pulling in a DOM environment and a React testing
library, which is a separate decision from the API-layer harness added here.

## Known gaps / follow-ups

- No component/browser tests (see above).
- No authentication on either API route (see [`SECURITY.md`](./SECURITY.md)).
- No persistence beyond the flat-file `knowledge/` directory (no DB, no
  vector store).
