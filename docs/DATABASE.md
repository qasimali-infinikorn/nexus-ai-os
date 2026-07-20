# Database Setup

The Knowledge Base (`app/api/knowledge/route.ts`) is the only feature that
needs a database. Everything else in the app (dashboard/CEO orchestration,
PR Reviewer, Architecture Studio, Proposal Creator, Research Digest) has no
database dependency at all.

## Requirements

Any Postgres with the [`pgvector`](https://github.com/pgvector/pgvector)
extension available. **Supabase** is the reference target — its free tier
includes Postgres with `pgvector` enableable via one `CREATE EXTENSION`
statement (already in the migration below).

## Setup

1. Create a Supabase project (or any Postgres instance you control).
2. Copy its connection string. On Supabase: **Project Settings → Database →
   Connection string**. Use the **Transaction** pooling mode string if
   you're deploying to a serverless platform like Vercel — the app's
   Postgres client (`lib/db/client.ts`) is already configured with
   `prepare: false`, which transaction-mode pooling (PgBouncer) requires.
3. Set `DATABASE_URL` to that connection string:
   - Locally: copy `.env.example` to `.env.local` and fill it in.
   - On Vercel: `vercel env add DATABASE_URL production` (and `preview`/
     `development` as needed), or add it via the Vercel dashboard's
     Environment Variables settings.
4. Apply the migrations in `drizzle/migrations/` to that database. Either:
   - Paste `drizzle/migrations/0000_confused_multiple_man.sql` into
     Supabase's SQL Editor and run it, or
   - Run `npx drizzle-kit migrate` locally with `DATABASE_URL` set.

That's it — no seed data or additional configuration needed.

## Schema (`lib/db/schema.ts`)

```
documents
  id          uuid primary key
  name        text, unique
  content     text
  created_at  timestamptz
  updated_at  timestamptz

document_chunks
  id            uuid primary key
  document_id   uuid -> documents.id, on delete cascade
  chunk_index   integer
  content       text
  embedding     vector(1536), nullable
  created_at    timestamptz
```

`embedding` is nullable: chunks are always stored, but the vector column is
only populated when the caller supplies an embedding-provider key on the
`add` request (see [`ARCHITECTURE.md`](./ARCHITECTURE.md#knowledge-base--rag-appapiknowledgerouteets)).
Keyword search doesn't need embeddings; semantic search does.

## Changing the schema

This is a normal Drizzle project:

1. Edit `lib/db/schema.ts`.
2. `npx drizzle-kit generate` — generates a new SQL file in
   `drizzle/migrations/` from the diff. This works offline; it doesn't need
   `DATABASE_URL` to be a real, reachable database.
3. Apply it to your actual database with `npx drizzle-kit migrate` (needs a
   real `DATABASE_URL`) or by pasting the generated SQL into Supabase's SQL
   Editor.
4. If you change `EMBEDDING_DIMENSIONS` or add a new embedding provider,
   existing stored embeddings become incompatible with new ones — you'd
   need to re-embed everything, not just migrate the column.

## Testing without a real database

`tests/helpers/testDb.ts` boots an embedded, in-memory Postgres
(`@electric-sql/pglite`, with the `pgvector` extension via
`@electric-sql/pglite-pgvector`) and runs the actual files in
`drizzle/migrations/` against it. `npm test` never touches a real database —
see [`ARCHITECTURE.md`](./ARCHITECTURE.md#testing-tests-vitest).
