CREATE TABLE "send_reservations" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"mailbox_id" text NOT NULL,
	"assignment_id" text NOT NULL,
	"step_number" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "send_reservations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "send_reservations_assignment_step_uq" ON "send_reservations" USING btree ("org_id","assignment_id","step_number");--> statement-breakpoint
CREATE INDEX "send_reservations_mailbox_expiry_idx" ON "send_reservations" USING btree ("org_id","mailbox_id","expires_at");--> statement-breakpoint
CREATE POLICY "send_reservations_app_tenant" ON "send_reservations" AS PERMISSIVE FOR ALL TO "samrian_app" USING (org_id = nullif(current_setting('app.org_id', true), '')) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), ''));--> statement-breakpoint
CREATE POLICY "send_reservations_worker_tenant" ON "send_reservations" AS PERMISSIVE FOR ALL TO "samrian_worker" USING (org_id = nullif(current_setting('app.org_id', true), '')) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), ''));--> statement-breakpoint
CREATE POLICY "send_reservations_worker_system_read" ON "send_reservations" AS PERMISSIVE FOR SELECT TO "samrian_worker" USING (current_setting('app.actor_type', true) = 'system');--> statement-breakpoint
CREATE POLICY "send_reservations_worker_system_update" ON "send_reservations" AS PERMISSIVE FOR UPDATE TO "samrian_worker" USING (current_setting('app.actor_type', true) = 'system') WITH CHECK (current_setting('app.actor_type', true) = 'system');--> statement-breakpoint
ALTER TABLE "send_reservations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "send_reservations" TO samrian_app, samrian_worker;
