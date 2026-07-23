ALTER TABLE "documents" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
UPDATE "documents" SET "organization_id" = (SELECT "id" FROM "organizations" ORDER BY "created_at" ASC LIMIT 1) WHERE "organization_id" IS NULL;--> statement-breakpoint
DELETE FROM "documents" WHERE "organization_id" IS NULL;--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
DROP INDEX IF EXISTS "documents_name_unique_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "documents_org_name_unique_idx" ON "documents" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX "documents_organization_id_idx" ON "documents" USING btree ("organization_id");
