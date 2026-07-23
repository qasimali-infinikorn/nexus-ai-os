# Security Model & Review Notes

## Key handling (Phase 1+: org-level BYOK)

As of Phase 1 (see [`AUTH.md`](./AUTH.md)) this app has real accounts and
organizations. The BYOK model moved from per-browser `localStorage` to
**org-level, server-side, encrypted**:

- An org owner/admin enters the org's AI provider key once, under
  **Settings → Integrations**. It's encrypted at rest (AES-256-GCM,
  `lib/crypto.ts`) in `org_provider_keys`, keyed by `ENCRYPTION_KEY`, and
  shared by every member of that org.
- `/api/orchestrate` requires an authenticated session and resolves the
  active key server-side via `getOrgProviderKey(session.organizationId,
  provider)` — the browser never sends a provider key, and no key is ever
  stored client-side.
- The server-side calls to OpenAI/Anthropic/Gemini in `lib/agents.ts` still
  exist to avoid CORS issues calling provider APIs directly from the browser.
- The Knowledge Base uses the same org OpenAI key for embeddings when
  documents are saved and when `mode: "semantic"` search runs — never a
  client-supplied key. Document rows are scoped by `organization_id`;
  list/add/delete/search never cross tenants.

**Implication:** a compromised `ENCRYPTION_KEY` (or direct database access)
exposes every org's provider keys — treat it as seriously as the keys
themselves, and never commit it. Losing/rotating `ENCRYPTION_KEY` makes
existing encrypted keys unreadable (org admins would need to re-enter them).

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

8. **No authentication on `/api/knowledge` or `/api/orchestrate`.** ~~If
   this app is ever deployed somewhere reachable by more than the local
   user, anyone can read/write/delete knowledge-base files and burn the
   caller's configured LLM quota.~~ **Fixed in Phase 1** (see
   [`AUTH.md`](./AUTH.md)): both routes now require an authenticated
   session (`auth()`), and rate limiting keys off the authenticated user id
   instead of client IP.

### Open — not fixed in this pass

See [`AUTH.md`](./AUTH.md)'s "Known gaps" for remaining auth items (mostly
end-to-end Auth.js cookie tests). Login rate limiting, invite emails,
password reset, and org switching are in place. Google and Microsoft
Calendar OAuth for Meetings are live (per-user connections). Notification
email (Resend) and Slack incoming webhooks honor the Settings →
Notifications matrix when configured.

Guardrail regression coverage lives in `tests/lib/guardrails.test.ts`
(limits + proxy public routes + webhook secret handling).

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
| Rate limit | `/api/orchestrate` | 20 req/min per authenticated user |
| Rate limit | `GET /api/knowledge` | 60 req/min per authenticated user |
| Rate limit | `POST /api/knowledge` | 30 req/min per authenticated user |
| Rate limit | `POST /api/webhooks/devops` | 60 req/min per client IP |
| Webhook auth | `POST /api/webhooks/devops` | `WEBHOOK_SECRET` via Bearer or `x-nexus-webhook-secret` (timing-safe) |
| Webhook auth | `POST /api/webhooks/github` | `X-Hub-Signature-256` + `GITHUB_WEBHOOK_SECRET` (or `WEBHOOK_SECRET`); optional `projectSlug` upserts Issues → Kanban |
| Webhook auth | `POST /api/webhooks/jira` | Bearer / header + `JIRA_WEBHOOK_SECRET` (or `WEBHOOK_SECRET`); optional `projectSlug` upserts Issues → Kanban |
| Webhook auth | `POST /api/webhooks/stripe` | `Stripe-Signature` + `STRIPE_WEBHOOK_SECRET` (timing-safe HMAC) |
| Rate limit | `POST /api/webhooks/stripe` | 60 req/min per client IP |
| Rate limit | `loginAction` (failed attempts) | 20 / 15 min per IP · 10 / 15 min per email |
| Rate limit | `requestPasswordResetAction` | 10 / hour per IP · 5 / hour per email |
| Invite email | Resend API | Same credentials; Settings → Team + admin Add tenant |
| Password reset | Resend + `password_reset_tokens` | 1-hour single-use `/reset-password/<token>` |
| Email notify | Resend API | `RESEND_API_KEY` + `EMAIL_FROM`; skipped when unset |
| Calendar OAuth | Google / Microsoft Calendar connect | Separate from Auth.js; HMAC state (`AUTH_SECRET`); encrypted refresh tokens |
| Slack notify | Incoming webhook | Per-user URL in `user_settings.delivery`; must be `hooks.slack.com` |
| `provider` allowlist | `/api/orchestrate` | `openai` \| `anthropic` \| `google` |
| `prompt` length | `/api/orchestrate` | 20,000 chars |
| `context` length | `/api/orchestrate` | 100,000 chars |
| `model` length | `/api/orchestrate` | 100 chars |
| Knowledge filename length | `/api/knowledge` | 200 chars |
| Knowledge content size | `/api/knowledge` (`add`) | 2 MB |
| Knowledge query length | `/api/knowledge` (`search`) | 500 chars |

All limits live in `lib/validation.ts` and `lib/rate-limit.ts` — adjust
there if they turn out to be too tight/loose in practice.
