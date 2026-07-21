import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector
} from "drizzle-orm/pg-core";

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

// ─────────────────────────────────────────────────────────────────────────
// Accounts, organizations, and access control.
//
// One user can belong to multiple organizations (via `memberships`); the
// active organization for a request is resolved from the session (see
// `lib/auth.ts`). `isPlatformAdmin` is a separate, org-independent flag for
// the Superadmin console — it is not a membership role.
// ─────────────────────────────────────────────────────────────────────────

export const ORGANIZATION_PLAN_TIERS = ["trial", "team", "business", "enterprise"] as const;
export const ORGANIZATION_STATUSES = ["trial", "active", "past_due", "suspended"] as const;
export const MEMBERSHIP_ROLES = ["owner", "admin", "member"] as const;
// Mirrors ALLOWED_PROVIDERS in lib/validation.ts.
export const ORG_KEY_PROVIDERS = ["openai", "anthropic", "google"] as const;

export type OrganizationPlanTier = (typeof ORGANIZATION_PLAN_TIERS)[number];
export type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number];
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];
export type OrgKeyProvider = (typeof ORG_KEY_PROVIDERS)[number];

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    planTier: text("plan_tier", { enum: ORGANIZATION_PLAN_TIERS }).notNull().default("trial"),
    status: text("status", { enum: ORGANIZATION_STATUSES }).notNull().default("trial"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [uniqueIndex("organizations_slug_unique_idx").on(table.slug)]
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    // Platform-operator flag for the Superadmin console — independent of
    // any organization membership/role.
    isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [uniqueIndex("users_email_unique_idx").on(table.email)]
);

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role: text("role", { enum: MEMBERSHIP_ROLES }).notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("memberships_user_org_unique_idx").on(table.userId, table.organizationId),
    index("memberships_organization_id_idx").on(table.organizationId)
  ]
);

// One encrypted provider key per organization+provider, shared by every
// member of that org (the "org-level BYOK" model — see docs/AUTH.md).
export const orgProviderKeys = pgTable(
  "org_provider_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: ORG_KEY_PROVIDERS }).notNull(),
    // AES-256-GCM ciphertext (see lib/crypto.ts), never a plaintext key.
    encryptedKey: text("encrypted_key").notNull(),
    updatedByUserId: uuid("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("org_provider_keys_org_provider_unique_idx").on(table.organizationId, table.provider)
  ]
);

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role", { enum: MEMBERSHIP_ROLES }).notNull().default("member"),
    token: text("token").notNull(),
    invitedByUserId: uuid("invited_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("invitations_token_unique_idx").on(table.token),
    index("invitations_organization_id_idx").on(table.organizationId)
  ]
);

// Immutable log of privileged actions (org-scoped and platform-scoped —
// `organizationId` is null for platform-level actions like Superadmin
// impersonation). Nothing ever updates or deletes a row here.
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("audit_log_organization_id_idx").on(table.organizationId),
    index("audit_log_created_at_idx").on(table.createdAt)
  ]
);

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Membership = typeof memberships.$inferSelect;
export type NewMembership = typeof memberships.$inferInsert;
export type OrgProviderKey = typeof orgProviderKeys.$inferSelect;
export type NewOrgProviderKey = typeof orgProviderKeys.$inferInsert;
export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;
