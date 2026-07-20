import fs from "fs";
import path from "path";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/lib/db/schema";
import type { Database } from "@/lib/db/client";

// Runs the real, checked-in Drizzle migrations against an embedded
// (in-memory, WASM) Postgres instance, so tests exercise actual SQL/pgvector
// behavior instead of a mocked-out database layer.
export async function createTestDb() {
  const client = new PGlite({ extensions: { vector } });
  const runSqlScript = client.exec.bind(client);

  const migrationsDir = path.join(process.cwd(), "drizzle", "migrations");
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of migrationFiles) {
    const script = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    await runSqlScript(script);
  }

  return drizzle(client, { schema }) as unknown as Database;
}
