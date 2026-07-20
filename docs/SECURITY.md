# Security Model & Review Notes

## Key handling (by design)

This app is a **bring-your-own-key** tool with no backend account system:

- API keys are entered in the Settings dialog (`app/page.tsx`) and stored in
  the browser's `localStorage`, in plaintext, under `nexus_key_openai`,
  `nexus_key_anthropic`, `nexus_key_google`.
- Every `/api/orchestrate` call sends the relevant key back to the server in
  the request body; the server never persists keys and holds no keys of its
  own (no `.env` / server-side credentials are used anywhere).
- The server-side calls to OpenAI/Anthropic/Gemini in `lib/agents.ts` exist
  only to avoid CORS issues calling provider APIs directly from the browser.
- The Knowledge Base's optional embedding key (`embed: { provider, key }` on
  `/api/knowledge`) follows the same per-request BYOK model — it's never
  persisted server-side either, only used inline to call the embeddings API
  for that one request.

**Implication:** anyone with script access to the page (XSS) or physical/
session access to the browser profile can read the keys out of
`localStorage`. Anyone who can reach the deployed origin over the network
can also spend those keys, since neither API route requires
authentication. This is an acceptable trade-off for a single-user local
tool, but this app **should not be deployed to a shared/public URL without
adding authentication in front of it** — see "Gaps" below.

## Findings from this review

### Fixed

1. **Regex-injection / ReDoS in knowledge search**
   (`app/api/knowledge/route.ts`) — `POST { action: "search" }` split the
   user's query into terms and passed each term straight into a dynamically
   constructed `RegExp`. A crafted term (e.g. containing unbalanced groups
   or a catastrophic-backtracking pattern) could throw or cause pathological
   regex evaluation. **Fix:** terms are now escaped with a standard
   `escapeRegExp` helper before being compiled into a `RegExp`.

2. **Unescaped `model` in the Gemini request URL** (`lib/agents.ts`) — the
   user-configurable `model` field (free text in Settings) was concatenated
   directly into the Gemini REST URL path and the `key` query parameter was
   interpolated unescaped too. A `model` value containing `/`, `?`, or `#`
   could alter the request path or append extra query parameters.
   **Fix:** both `model` and `key` are now passed through
   `encodeURIComponent()`.

3. **No size limit on `POST /api/knowledge { action: "add" }`.**
   (`app/api/knowledge/route.ts`) — content was written to disk with no cap.
   **Fix:** content is now rejected with `400` if it exceeds
   `MAX_KNOWLEDGE_CONTENT_BYTES` (2 MB, `lib/validation.ts`); filenames and
   search queries are similarly length-capped.

4. **Model/provider input wasn't validated against an allowlist.**
   (`app/api/orchestrate/route.ts`) — `provider` and `model` were passed
   through unchecked. **Fix:** `provider` must now be one of
   `ALLOWED_PROVIDERS` (`lib/validation.ts`) and `model`/`prompt`/`context`
   are length-capped; all of this is validated before the response stream
   opens, so bad input gets a clean `400` instead of an error event
   mid-stream.

5. **No rate limiting** on either route. **Fix:** an in-memory,
   per-client-IP rate limiter (`lib/rate-limit.ts`) now guards both routes —
   20 req/min for `/api/orchestrate` (it can trigger up to 3 sequential LLM
   calls per request in coordinator mode), 60 req/min for `GET
   /api/knowledge`, and 30 req/min for `POST /api/knowledge`. Exceeding the
   limit returns `429` with a `Retry-After` header. This is single-process,
   in-memory state — see the caveat in `lib/rate-limit.ts` if this app is
   ever run across multiple instances.

6. **Hardened path resolution for the knowledge file API (now moot).** The
   original `path.basename()` sanitization already blocked `../` traversal,
   but a name of `"."` or `".."` could still survive it and resolve to the
   knowledge directory itself or its parent (writes/deletes on a directory
   fail with `EISDIR`/`EPERM` rather than succeeding, so this wasn't
   exploitable, but it was hardened to reject those names outright). The
   Knowledge Base has since moved from the filesystem to Postgres (see
   [`ARCHITECTURE.md`](./ARCHITECTURE.md#knowledge-base--rag-appapiknowledgerouteets)),
   so this whole class of finding no longer applies — `name` is just a
   unique text label now, not a filesystem path.

7. **`/api/knowledge`'s read and write rate limits shared one counter.**
   Found via live testing after deployment: `GET` (60/min) and `POST`
   (30/min) both keyed their rate-limit bucket as `knowledge:<client>`, so
   exhausting one budget could trip the other early, and whichever endpoint
   happened to be called would compare the *shared* count against its *own*
   declared limit — not the independent budgets the docs described.
   **Fix:** buckets are now keyed `knowledge:read:<client>` /
   `knowledge:write:<client>`; verified live (write budget now exhausts at
   exactly request 31 with the 30/min limit, `GET` unaffected) and covered
   by a regression test.

### Open — not fixed in this pass

8. **No authentication on `/api/knowledge` or `/api/orchestrate`.** If this
   app is ever deployed somewhere reachable by more than the local user,
   anyone can read/write/delete knowledge-base files and burn the caller's
   configured LLM quota (the new rate limits slow this down but don't stop
   it). This needs a deliberate choice of auth mechanism (shared secret,
   session, reverse-proxy) plus matching client-side UI, so it's left as a
   decision for before any non-local deployment rather than half-wired in
   this pass.

## What's already safe

- **No raw HTML injection surface:** `components/markdown.tsx` renders
  LLM/user content exclusively through React elements — it builds output
  node-by-node from parsed text rather than inserting markup, so LLM output
  cannot execute scripts in the page.
- **No SQL injection surface:** all Knowledge Base queries go through
  Drizzle's query builder (`lib/db/schema.ts`, `app/api/knowledge/route.ts`),
  which parameterizes every value — document name/content, search query
  terms, and embedding vectors are never string-interpolated into SQL.
- No dynamic code evaluation (`eval`, dynamically-constructed function
  bodies) or `child_process` usage anywhere in the codebase.

## Guardrail reference

| Guardrail | Where | Limit |
|---|---|---|
| Rate limit | `/api/orchestrate` | 20 req/min per client key |
| Rate limit | `GET /api/knowledge` | 60 req/min per client key |
| Rate limit | `POST /api/knowledge` | 30 req/min per client key |
| `provider` allowlist | `/api/orchestrate` | `openai` \| `anthropic` \| `google` |
| `prompt` length | `/api/orchestrate` | 20,000 chars |
| `context` length | `/api/orchestrate` | 100,000 chars |
| `model` length | `/api/orchestrate` | 100 chars |
| Knowledge filename length | `/api/knowledge` | 200 chars |
| Knowledge content size | `/api/knowledge` (`add`) | 2 MB |
| Knowledge query length | `/api/knowledge` (`search`) | 500 chars |

All limits live in `lib/validation.ts` and `lib/rate-limit.ts` — adjust
there if they turn out to be too tight/loose in practice.
