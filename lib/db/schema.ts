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
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    /** Monthly recurring revenue in cents from the active Stripe subscription. */
    mrrCents: integer("mrr_cents"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("organizations_slug_unique_idx").on(table.slug),
    uniqueIndex("organizations_stripe_customer_unique_idx").on(table.stripeCustomerId)
  ]
);

/** Org-scoped Knowledge Base documents (never shared across tenants). */
export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("documents_org_name_unique_idx").on(table.organizationId, table.name),
    index("documents_organization_id_idx").on(table.organizationId)
  ]
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

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("password_reset_tokens_token_unique_idx").on(table.token),
    index("password_reset_tokens_user_id_idx").on(table.userId)
  ]
);

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────
// Platform feature flags (Superadmin). Global rows + optional per-tenant
// overrides. Resolution lives in lib/db/feature-flags.ts.
// ─────────────────────────────────────────────────────────────────────────

export const FEATURE_FLAG_STATUSES = ["ga", "beta", "alpha"] as const;
export const FEATURE_FLAG_AUDIENCES = [
  "all",
  "business_plus",
  "enterprise",
  "opt_in",
  "tenant_list"
] as const;

export type FeatureFlagStatus = (typeof FEATURE_FLAG_STATUSES)[number];
export type FeatureFlagAudience = (typeof FEATURE_FLAG_AUDIENCES)[number];

export const featureFlags = pgTable(
  "feature_flags",
  {
    key: text("key").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    status: text("status", { enum: FEATURE_FLAG_STATUSES }).notNull().default("ga"),
    audience: text("audience", { enum: FEATURE_FLAG_AUDIENCES }).notNull().default("all"),
    enabled: boolean("enabled").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    updatedByUserId: uuid("updated_by_user_id").references(() => users.id, { onDelete: "set null" })
  }
);

export const featureFlagTenants = pgTable(
  "feature_flag_tenants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    flagKey: text("flag_key")
      .notNull()
      .references(() => featureFlags.key, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("feature_flag_tenants_flag_org_unique_idx").on(table.flagKey, table.organizationId),
    index("feature_flag_tenants_organization_id_idx").on(table.organizationId)
  ]
);

export type FeatureFlag = typeof featureFlags.$inferSelect;
export type NewFeatureFlag = typeof featureFlags.$inferInsert;
export type FeatureFlagTenant = typeof featureFlagTenants.$inferSelect;
export type NewFeatureFlagTenant = typeof featureFlagTenants.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────
// Project tasks — the first slice of workspace content promoted from the
// seed module (lib/workspace/content.ts) into real, editable rows, because
// the Kanban board mutates them (drag between columns, create, edit).
//
// Scoped by `projectSlug` rather than a projects FK: the project list is
// still display-only demo content, so a full projects table would be dead
// weight. When projects become editable this gains a proper FK.
// ─────────────────────────────────────────────────────────────────────────

export const TASK_STATUSES = ["To Do", "In Progress", "In Review", "Done"] as const;
export const TASK_KINDS = ["story", "bug", "task"] as const;
export const TASK_PRIORITIES = ["Critical", "High", "Med", "Low"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskKind = (typeof TASK_KINDS)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_SOURCES = ["manual", "jira", "github"] as const;
export type TaskSource = (typeof TASK_SOURCES)[number];

export const projectTasks = pgTable(
  "project_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectSlug: text("project_slug").notNull(),
    /** Human-facing key, e.g. "NX-2140". Unique per organization. */
    ref: text("ref").notNull(),
    kind: text("kind", { enum: TASK_KINDS }).notNull().default("task"),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status", { enum: TASK_STATUSES }).notNull().default("To Do"),
    priority: text("priority", { enum: TASK_PRIORITIES }).notNull().default("Med"),
    points: integer("points").notNull().default(1),
    assignee: text("assignee").notNull().default("—"),
    avatarIndex: integer("avatar_index").notNull().default(0),
    // Sprint-day span (1..10) driving the Timeline view.
    startDay: integer("start_day").notNull().default(1),
    endDay: integer("end_day").notNull().default(1),
    // Position within its status column; gaps are fine, only order matters.
    sortOrder: integer("sort_order").notNull().default(0),
    /** Origin of the task — webhook sync vs manual board create. */
    source: text("source", { enum: TASK_SOURCES }).notNull().default("manual"),
    /** Provider-native id, e.g. Jira `PROJ-12` or GitHub `owner/repo#42`. */
    externalId: text("external_id"),
    externalUrl: text("external_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("project_tasks_org_ref_unique_idx").on(table.organizationId, table.ref),
    uniqueIndex("project_tasks_org_external_unique_idx").on(table.organizationId, table.externalId),
    index("project_tasks_org_project_idx").on(table.organizationId, table.projectSlug)
  ]
);

export type ProjectTask = typeof projectTasks.$inferSelect;
export type NewProjectTask = typeof projectTasks.$inferInsert;

// Projects — promoted out of the seed module for the same reason as
// project_tasks: the "New project" flow creates them, so they need to be
// real rows. Seeded lazily per organization from lib/workspace/content.ts.

export const PROJECT_STATUSES = ["On track", "At risk", "Off track"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    /** Ticket prefix, e.g. "NX" -> NX-2142. */
    key: text("key").notNull(),
    initials: text("initials").notNull(),
    avatarIndex: integer("avatar_index").notNull().default(0),
    accent: text("accent").notNull().default("#2563eb"),
    lead: text("lead").notNull(),
    status: text("status", { enum: PROJECT_STATUSES }).notNull().default("On track"),
    sprintLabel: text("sprint_label").notNull().default("Sprint 1 · day 1/10"),
    progress: integer("progress").notNull().default(0),
    openIssues: integer("open_issues").notNull().default(0),
    engineers: integer("engineers").notNull().default(1),
    /** Red footer callout, e.g. "1 blocker" / "2 incidents". */
    warning: text("warning"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [uniqueIndex("projects_org_slug_unique_idx").on(table.organizationId, table.slug)]
);

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

// Per-user, per-organization preferences (notification matrix, appearance).
// Stored as jsonb rather than a column per switch so adding a notification
// channel or event doesn't need a migration.

export const userSettings = pgTable(
  "user_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** { [eventId]: { inApp: bool, email: bool, slack: bool } } */
    notificationPrefs: jsonb("notification_prefs"),
    /** { reduceMotion: bool, comfortableDensity: bool, ... } */
    appearance: jsonb("appearance"),
    /** { slackWebhookUrl?: string } — incoming webhook for Slack channel delivery */
    delivery: jsonb("delivery").$type<{ slackWebhookUrl?: string }>(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [uniqueIndex("user_settings_user_org_unique_idx").on(table.userId, table.organizationId)]
);

export type UserSettings = typeof userSettings.$inferSelect;

// ─────────────────────────────────────────────────────────────────────────
// Phase 2 workspace data — notifications, meetings, agent runs, DevOps.
// ─────────────────────────────────────────────────────────────────────────

export const NOTIFICATION_KINDS = ["Incidents", "Reviews", "Mentions", "Agents"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** Null = org-wide broadcast visible to every member. */
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: NOTIFICATION_KINDS }).notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    href: text("href").notNull().default("/notifications"),
    tone: text("tone").notNull().default("slate"),
    badge: text("badge"),
    unread: boolean("unread").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("notifications_org_created_idx").on(table.organizationId, table.createdAt),
    index("notifications_org_user_idx").on(table.organizationId, table.userId)
  ]
);

export type Notification = typeof notifications.$inferSelect;

export const meetings = pgTable(
  "meetings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    location: text("location"),
    kind: text("kind").notNull().default("internal"),
    attendees: jsonb("attendees").$type<string[]>().notNull().default([]),
    needsPrep: boolean("needs_prep").notNull().default(true),
    agenda: text("agenda"),
    source: text("source").notNull().default("manual"),
    /** External calendar event id when source is google / microsoft. */
    externalId: text("external_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("meetings_org_starts_idx").on(table.organizationId, table.startsAt),
    uniqueIndex("meetings_org_external_unique_idx").on(table.organizationId, table.externalId)
  ]
);

export type Meeting = typeof meetings.$inferSelect;

export const meetingActionItems = pgTable(
  "meeting_action_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    owner: text("owner").notNull().default("—"),
    done: boolean("done").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("meeting_action_items_meeting_idx").on(table.meetingId)]
);

export type MeetingActionItem = typeof meetingActionItems.$inferSelect;

export const AGENT_RUN_STATUSES = ["running", "succeeded", "failed"] as const;
export type AgentRunStatus = (typeof AGENT_RUN_STATUSES)[number];

export const agentRuns = pgTable(
  "agent_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    agentType: text("agent_type").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    prompt: text("prompt").notNull(),
    status: text("status", { enum: AGENT_RUN_STATUSES }).notNull().default("running"),
    resultExcerpt: text("result_excerpt"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true })
  },
  (table) => [
    index("agent_runs_org_created_idx").on(table.organizationId, table.createdAt),
    index("agent_runs_org_agent_idx").on(table.organizationId, table.agentType)
  ]
);

export type AgentRun = typeof agentRuns.$inferSelect;

export const DEPLOYMENT_STATUSES = ["success", "failed", "in_progress"] as const;
export type DeploymentStatus = (typeof DEPLOYMENT_STATUSES)[number];

export const deployments = pgTable(
  "deployments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    service: text("service").notNull(),
    version: text("version").notNull(),
    status: text("status", { enum: DEPLOYMENT_STATUSES }).notNull().default("success"),
    detail: text("detail"),
    externalId: text("external_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("deployments_org_created_idx").on(table.organizationId, table.createdAt)]
);

export type Deployment = typeof deployments.$inferSelect;

export const INCIDENT_SEVERITIES = ["critical", "high", "medium", "low"] as const;
export const INCIDENT_STATUSES = ["open", "acknowledged", "resolved"] as const;
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const incidents = pgTable(
  "incidents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    title: text("title").notNull(),
    severity: text("severity", { enum: INCIDENT_SEVERITIES }).notNull().default("medium"),
    status: text("status", { enum: INCIDENT_STATUSES }).notNull().default("open"),
    summary: text("summary"),
    externalId: text("external_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true })
  },
  (table) => [
    uniqueIndex("incidents_org_code_unique_idx").on(table.organizationId, table.code),
    index("incidents_org_created_idx").on(table.organizationId, table.createdAt)
  ]
);

export type Incident = typeof incidents.$inferSelect;

// User-linked OAuth connections (calendar, etc.) — separate from Auth.js login.
export const OAUTH_CONNECTION_PROVIDERS = ["google_calendar", "microsoft_calendar"] as const;
export type OAuthConnectionProvider = (typeof OAUTH_CONNECTION_PROVIDERS)[number];

export const userOauthConnections = pgTable(
  "user_oauth_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: OAUTH_CONNECTION_PROVIDERS }).notNull(),
    accountEmail: text("account_email"),
    // AES-256-GCM ciphertext (lib/crypto.ts)
    encryptedRefreshToken: text("encrypted_refresh_token").notNull(),
    scopes: text("scopes"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("user_oauth_connections_user_org_provider_idx").on(
      table.userId,
      table.organizationId,
      table.provider
    )
  ]
);

export type UserOauthConnection = typeof userOauthConnections.$inferSelect;

/** Org-defined specialist agents (in addition to built-in AGENTS). */
export const orgCustomAgents = pgTable(
  "org_custom_agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    systemPrompt: text("system_prompt").notNull(),
    accent: text("accent").notNull().default("blue"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("org_custom_agents_org_key_unique_idx").on(table.organizationId, table.key),
    index("org_custom_agents_org_idx").on(table.organizationId)
  ]
);

export type OrgCustomAgent = typeof orgCustomAgents.$inferSelect;

/** Platform-wide status banners (Superadmin System Status), not tenant DevOps incidents. */
export const PLATFORM_INCIDENT_SEVERITIES = ["critical", "high", "medium", "low"] as const;
export const PLATFORM_INCIDENT_STATUSES = ["open", "resolved"] as const;
export type PlatformIncidentSeverity = (typeof PLATFORM_INCIDENT_SEVERITIES)[number];
export type PlatformIncidentStatus = (typeof PLATFORM_INCIDENT_STATUSES)[number];

export const platformIncidents = pgTable(
  "platform_incidents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    summary: text("summary"),
    severity: text("severity", { enum: PLATFORM_INCIDENT_SEVERITIES }).notNull().default("medium"),
    status: text("status", { enum: PLATFORM_INCIDENT_STATUSES }).notNull().default("open"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true })
  },
  (table) => [
    index("platform_incidents_status_created_idx").on(table.status, table.createdAt)
  ]
);

export type PlatformIncident = typeof platformIncidents.$inferSelect;

export const BILLING_INVOICE_STATUSES = ["draft", "open", "paid", "void", "uncollectible"] as const;
export type BillingInvoiceStatus = (typeof BILLING_INVOICE_STATUSES)[number];

export const billingInvoices = pgTable(
  "billing_invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    stripeInvoiceId: text("stripe_invoice_id").notNull(),
    amountCents: integer("amount_cents").notNull().default(0),
    currency: text("currency").notNull().default("usd"),
    status: text("status", { enum: BILLING_INVOICE_STATUSES }).notNull().default("open"),
    periodStart: timestamp("period_start", { withTimezone: true }),
    periodEnd: timestamp("period_end", { withTimezone: true }),
    hostedInvoiceUrl: text("hosted_invoice_url"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("billing_invoices_stripe_id_unique_idx").on(table.stripeInvoiceId),
    index("billing_invoices_org_created_idx").on(table.organizationId, table.createdAt),
    index("billing_invoices_status_idx").on(table.status)
  ]
);

export type BillingInvoice = typeof billingInvoices.$inferSelect;
