import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    // Only read when actually running a drizzle-kit command against a live
    // database (e.g. `migrate`), not for offline `generate`.
    url: process.env.DATABASE_URL ?? "postgres://placeholder:placeholder@localhost:5432/placeholder"
  }
});
