CREATE TABLE "org_custom_agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"system_prompt" text NOT NULL,
	"accent" text DEFAULT 'blue' NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_oauth_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"account_email" text,
	"encrypted_refresh_token" text NOT NULL,
	"scopes" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "org_custom_agents" ADD CONSTRAINT "org_custom_agents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_custom_agents" ADD CONSTRAINT "org_custom_agents_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_oauth_connections" ADD CONSTRAINT "user_oauth_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_oauth_connections" ADD CONSTRAINT "user_oauth_connections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "org_custom_agents_org_key_unique_idx" ON "org_custom_agents" USING btree ("organization_id","key");--> statement-breakpoint
CREATE INDEX "org_custom_agents_org_idx" ON "org_custom_agents" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_oauth_connections_user_org_provider_idx" ON "user_oauth_connections" USING btree ("user_id","organization_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "meetings_org_external_unique_idx" ON "meetings" USING btree ("organization_id","external_id");