import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid, vector } from "drizzle-orm/pg-core";

// OpenAI's text-embedding-3-small dimension. If another embedding provider
// is added later with a different dimension, this column (and any stored
// vectors) would need to be migrated alongside it.
export const EMBEDDING_DIMENSIONS = 1536;

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [uniqueIndex("documents_name_unique_idx").on(table.name)]
);

export const documentChunks = pgTable(
  "document_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    // Nullable: chunks are stored even when no embedding provider key was
    // supplied at write time, so the keyword-search fallback keeps working.
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("document_chunks_document_id_idx").on(table.documentId)]
);

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type DocumentChunk = typeof documentChunks.$inferSelect;
export type NewDocumentChunk = typeof documentChunks.$inferInsert;
