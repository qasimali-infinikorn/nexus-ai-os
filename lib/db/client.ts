import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePostgresJs } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Both the postgres-js driver (production) and the pglite driver (tests)
// produce a PgDatabase over this schema, just with different PgQueryResultHKT
// implementations, so callers can treat either the same way.
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

let db: Database | null = null;

// Lazily creates the Postgres connection on first use rather than at import
// time, so routes that don't touch the database (and the test suite, via
// __setDbForTests) never need DATABASE_URL to be set.
export function getDb(): Database {
  if (db) return db;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Configure a Postgres connection string (e.g. from a Supabase project's " +
        "Connection string settings) to use the Knowledge Base."
    );
  }

  // `prepare: false` is required when connecting through Supabase's
  // transaction-mode pooler (PgBouncer), which doesn't support prepared
  // statements. Harmless against a direct (non-pooled) connection too.
  const client = postgres(connectionString, { prepare: false });
  db = drizzlePostgresJs(client, { schema }) as unknown as Database;
  return db;
}

export function __setDbForTests(testDb: Database | null): void {
  db = testDb;
}
