CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"key" text NOT NULL,
	"initials" text NOT NULL,
	"avatar_index" integer DEFAULT 0 NOT NULL,
	"accent" text DEFAULT '#2563eb' NOT NULL,
	"lead" text NOT NULL,
	"status" text DEFAULT 'On track' NOT NULL,
	"sprint_label" text DEFAULT 'Sprint 1 · day 1/10' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"open_issues" integer DEFAULT 0 NOT NULL,
	"engineers" integer DEFAULT 1 NOT NULL,
	"warning" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "projects_org_slug_unique_idx" ON "projects" USING btree ("organization_id","slug");