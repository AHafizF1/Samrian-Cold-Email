CREATE TABLE "organization_roles" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"role" text NOT NULL,
	"permission" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "organization_roles_org_idx" ON "organization_roles" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_roles_org_role_uq" ON "organization_roles" USING btree ("organization_id","role");
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "organization_roles" TO samrian_auth;
