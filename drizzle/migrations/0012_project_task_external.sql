ALTER TABLE "project_tasks" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD COLUMN "external_url" text;--> statement-breakpoint
CREATE UNIQUE INDEX "project_tasks_org_external_unique_idx" ON "project_tasks" USING btree ("organization_id","external_id");
