CREATE TABLE "project_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_slug" text NOT NULL,
	"ref" text NOT NULL,
	"kind" text DEFAULT 'task' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'To Do' NOT NULL,
	"priority" text DEFAULT 'Med' NOT NULL,
	"points" integer DEFAULT 1 NOT NULL,
	"assignee" text DEFAULT '—' NOT NULL,
	"avatar_index" integer DEFAULT 0 NOT NULL,
	"start_day" integer DEFAULT 1 NOT NULL,
	"end_day" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_tasks_org_ref_unique_idx" ON "project_tasks" USING btree ("organization_id","ref");--> statement-breakpoint
CREATE INDEX "project_tasks_org_project_idx" ON "project_tasks" USING btree ("organization_id","project_slug");