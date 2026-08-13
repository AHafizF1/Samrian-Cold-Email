CREATE TYPE "public"."blocklist_reason" AS ENUM('unsubscribed', 'bounced_hard', 'manual');--> statement-breakpoint
DO $$ BEGIN
  CREATE ROLE samrian_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
EXCEPTION WHEN duplicate_object THEN
  ALTER ROLE samrian_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE ROLE samrian_auth NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
EXCEPTION WHEN duplicate_object THEN
  ALTER ROLE samrian_auth NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE ROLE samrian_worker NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
EXCEPTION WHEN duplicate_object THEN
  ALTER ROLE samrian_worker NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
END $$;--> statement-breakpoint
CREATE TYPE "public"."assignment_status" AS ENUM('active', 'replied', 'bounced', 'unsubscribed', 'completed');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'active', 'paused', 'completed');--> statement-breakpoint
CREATE TYPE "public"."group_logic" AS ENUM('AND', 'OR');--> statement-breakpoint
CREATE TYPE "public"."group_operator" AS ENUM('equals', 'notEquals', 'contains', 'notContains', 'startsWith', 'endsWith', 'in', 'notIn', 'gt', 'gte', 'lt', 'lte', 'exists', 'notExists');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('valid', 'invalid', 'risky', 'unverifiable');--> statement-breakpoint
CREATE TYPE "public"."email_event_type" AS ENUM('sent', 'failed', 'reply', 'unsubscribe', 'bounce_hard', 'bounce_soft', 'auto_reply', 'click', 'open');--> statement-breakpoint
CREATE TYPE "public"."mailbox_provider" AS ENUM('smtp', 'puzzle', 'mailpool', 'google', 'microsoft');--> statement-breakpoint
CREATE TYPE "public"."mailbox_status" AS ENUM('active', 'disconnected', 'limit_reached');--> statement-breakpoint
CREATE TYPE "public"."ramp_status" AS ENUM('disabled', 'pending', 'ramping', 'ready', 'held', 'reduced', 'paused', 'recovering');--> statement-breakpoint
CREATE TYPE "public"."thread_direction" AS ENUM('sent', 'received');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"user_id" text NOT NULL,
	"action" text NOT NULL,
	"details" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "org_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"encrypted_mailpool_key" text,
	"physical_address" text,
	"default_sender_name" text,
	"unsubscribe_footer" text,
	"unsubscribe_mailto" text,
	"list_unsubscribe_enabled" boolean DEFAULT false NOT NULL,
	"click_tracking_enabled" boolean DEFAULT false NOT NULL,
	"open_tracking_enabled" boolean DEFAULT false NOT NULL,
	"bounce_pause_rate" real DEFAULT 0.05 NOT NULL,
	"unsubscribe_pause_rate" real DEFAULT 0.1 NOT NULL,
	"complaint_pause_rate" real DEFAULT 0.001 NOT NULL,
	"default_ramp_enabled" boolean DEFAULT false NOT NULL,
	"default_ramp_target" integer DEFAULT 30 NOT NULL,
	"reply_reserve" integer DEFAULT 2 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "org_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sender_domains" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"domain" text NOT NULL,
	"source" text DEFAULT 'dns' NOT NULL,
	"status" text NOT NULL,
	"checks" jsonb NOT NULL,
	"issues" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"checked_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sender_domains" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "api_idempotency" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"credential_id" text NOT NULL,
	"operation_id" text NOT NULL,
	"key" text NOT NULL,
	"fingerprint" text NOT NULL,
	"state" text DEFAULT 'processing' NOT NULL,
	"result" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_idempotency" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "apikeys" (
	"id" text PRIMARY KEY NOT NULL,
	"config_id" text DEFAULT 'automation' NOT NULL,
	"name" text,
	"start" text,
	"prefix" text,
	"reference_id" text NOT NULL,
	"key" text NOT NULL,
	"refill_interval" integer,
	"refill_amount" integer,
	"last_refill_at" timestamp with time zone,
	"enabled" boolean DEFAULT true NOT NULL,
	"rate_limit_enabled" boolean DEFAULT true NOT NULL,
	"rate_limit_time_window" integer,
	"rate_limit_max" integer,
	"request_count" integer DEFAULT 0 NOT NULL,
	"remaining" integer,
	"last_request" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"permissions" text,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jwks" (
	"id" text PRIMARY KEY NOT NULL,
	"public_key" text NOT NULL,
	"private_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"active_organization_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"name" text NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"two_factor_enabled" boolean,
	"is_anonymous" boolean,
	"username" text,
	"display_username" text,
	"phone_number" text,
	"phone_number_verified" boolean
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blocklist" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"email" text NOT NULL,
	"reason" "blocklist_reason" NOT NULL,
	"campaign_id" text,
	"unsubscribe_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "blocklist" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "campaign_mailboxes" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"mailbox_id" text NOT NULL,
	"org_id" text NOT NULL,
	"status" text DEFAULT 'enabled' NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "campaign_mailboxes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"status" "campaign_status" DEFAULT 'draft' NOT NULL,
	"schedule" jsonb NOT NULL,
	"steps" jsonb NOT NULL,
	"mailbox_rotation" text,
	"target_group_id" text,
	"target_contact_ids" jsonb,
	"list_unsubscribe_enabled" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaigns" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "contact_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"org_id" text NOT NULL,
	"status" "assignment_status" DEFAULT 'active' NOT NULL,
	"current_step" integer DEFAULT 0 NOT NULL,
	"assigned_mailbox_id" text,
	"last_email_sent_at" timestamp with time zone,
	"next_send_at" timestamp with time zone,
	"last_enqueued_at" timestamp with time zone,
	"last_replied_at" timestamp with time zone,
	"step_delays" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contact_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "contact_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"rules" jsonb NOT NULL,
	"logic" "group_logic" NOT NULL,
	"is_dynamic" boolean NOT NULL,
	"contact_ids" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contact_groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"email" text NOT NULL,
	"domain" text,
	"custom_vars" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"timezone" text,
	"bounce_status" text,
	"verification_status" "verification_status",
	"verification_checked_at" timestamp,
	"verification_reason" text,
	"verification_provider" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contacts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "campaign_stats_daily" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"campaign_id" text NOT NULL,
	"day" text NOT NULL,
	"sent" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"replies" integer DEFAULT 0 NOT NULL,
	"unsubscribes" integer DEFAULT 0 NOT NULL,
	"hard_bounces" integer DEFAULT 0 NOT NULL,
	"soft_bounces" integer DEFAULT 0 NOT NULL,
	"total_clicks" integer DEFAULT 0 NOT NULL,
	"unique_clicks" integer DEFAULT 0 NOT NULL,
	"total_opens" integer DEFAULT 0 NOT NULL,
	"unique_opens" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaign_stats_daily" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "email_events" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"campaign_id" text,
	"contact_id" text,
	"mailbox_id" text,
	"assignment_id" text,
	"thread_id" text,
	"message_id" text,
	"type" "email_event_type" NOT NULL,
	"step_number" integer,
	"dedupe_key" text NOT NULL,
	"metadata" jsonb,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "mailbox_stats_daily" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"mailbox_id" text NOT NULL,
	"day" text NOT NULL,
	"sent" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"replies" integer DEFAULT 0 NOT NULL,
	"unsubscribes" integer DEFAULT 0 NOT NULL,
	"hard_bounces" integer DEFAULT 0 NOT NULL,
	"soft_bounces" integer DEFAULT 0 NOT NULL,
	"total_clicks" integer DEFAULT 0 NOT NULL,
	"unique_clicks" integer DEFAULT 0 NOT NULL,
	"total_opens" integer DEFAULT 0 NOT NULL,
	"unique_opens" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mailbox_stats_daily" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "org_stats_daily" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"day" text NOT NULL,
	"sent" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"replies" integer DEFAULT 0 NOT NULL,
	"unsubscribes" integer DEFAULT 0 NOT NULL,
	"hard_bounces" integer DEFAULT 0 NOT NULL,
	"soft_bounces" integer DEFAULT 0 NOT NULL,
	"total_clicks" integer DEFAULT 0 NOT NULL,
	"unique_clicks" integer DEFAULT 0 NOT NULL,
	"total_opens" integer DEFAULT 0 NOT NULL,
	"unique_opens" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "org_stats_daily" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tracked_links" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"campaign_id" text,
	"contact_id" text,
	"assignment_id" text,
	"thread_id" text,
	"message_id" text,
	"token" text NOT NULL,
	"original_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tracked_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "mailboxes" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"provider" "mailbox_provider" NOT NULL,
	"smtp_host" text,
	"smtp_port" integer,
	"imap_host" text,
	"imap_port" integer,
	"username" text,
	"encrypted_password" text,
	"encrypted_refresh_token" text,
	"encrypted_access_token" text,
	"token_expires_at" timestamp with time zone,
	"user_email" text,
	"daily_send_limit" integer NOT NULL,
	"emails_sent_today" integer DEFAULT 0 NOT NULL,
	"reserved_sends" integer DEFAULT 0 NOT NULL,
	"status" "mailbox_status" DEFAULT 'active' NOT NULL,
	"last_polled_at" timestamp with time zone,
	"last_successful_send_at" timestamp with time zone,
	"last_connection_test_at" timestamp with time zone,
	"last_connection_error" text,
	"last_token_refresh_at" timestamp with time zone,
	"last_token_refresh_error" text,
	"provider_limit_code" text,
	"provider_limit_reset_at" timestamp with time zone,
	"ramp_enabled" boolean DEFAULT false NOT NULL,
	"ramp_status" "ramp_status" DEFAULT 'disabled' NOT NULL,
	"ramp_started_at" timestamp with time zone,
	"ramp_updated_at" timestamp with time zone,
	"ramp_current_limit" integer,
	"ramp_target_limit" integer DEFAULT 30 NOT NULL,
	"ramp_increment" integer DEFAULT 5 NOT NULL,
	"ramp_next_check_at" timestamp with time zone,
	"ramp_hold_until" timestamp with time zone,
	"ramp_reason" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mailboxes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notification_prefs" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"user_id" text NOT NULL,
	"reply_in_app_enabled" boolean DEFAULT true NOT NULL,
	"reply_forward_enabled" boolean DEFAULT false NOT NULL,
	"reply_forward_emails" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"browser_push_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_prefs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"user_id" text,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"data" jsonb,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"status" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"inviter_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "thread_reads" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"user_id" text NOT NULL,
	"thread_id" text NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "thread_reads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "threads" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"campaign_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"mailbox_id" text NOT NULL,
	"message_id" text NOT NULL,
	"client_request_id" text,
	"in_reply_to" text,
	"references" jsonb,
	"provider_thread_id" text,
	"classification" text,
	"processed_at" timestamp with time zone,
	"raw_headers" jsonb,
	"direction" "thread_direction" NOT NULL,
	"from" text NOT NULL,
	"to" jsonb NOT NULL,
	"subject" text NOT NULL,
	"text_body" text,
	"html_body" text,
	"headers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"eml_key" text,
	"sent_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "threads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "audit_logs_org_id_idx" ON "audit_logs" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "org_settings_org_id_idx" ON "org_settings" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "sender_domains_org_id_idx" ON "sender_domains" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "sender_domains_org_domain_idx" ON "sender_domains" USING btree ("org_id","domain");--> statement-breakpoint
CREATE UNIQUE INDEX "api_idempotency_key_uq" ON "api_idempotency" USING btree ("org_id","credential_id","operation_id","key");--> statement-breakpoint
CREATE INDEX "api_idempotency_expires_idx" ON "api_idempotency" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "accounts_account_provider_idx" ON "accounts" USING btree ("account_id","provider_id");--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "apikeys_config_id_idx" ON "apikeys" USING btree ("config_id");--> statement-breakpoint
CREATE INDEX "apikeys_reference_id_idx" ON "apikeys" USING btree ("reference_id");--> statement-breakpoint
CREATE INDEX "apikeys_key_idx" ON "apikeys" USING btree ("key");--> statement-breakpoint
CREATE INDEX "sessions_token_idx" ON "sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "blocklist_org_email_idx" ON "blocklist" USING btree ("org_id","email");--> statement-breakpoint
CREATE INDEX "blocklist_email_idx" ON "blocklist" USING btree ("email");--> statement-breakpoint
CREATE INDEX "campaign_mailboxes_campaign_id_idx" ON "campaign_mailboxes" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "campaign_mailboxes_mailbox_id_idx" ON "campaign_mailboxes" USING btree ("mailbox_id");--> statement-breakpoint
CREATE INDEX "campaign_mailboxes_org_id_idx" ON "campaign_mailboxes" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_mailboxes_org_campaign_mailbox_uq" ON "campaign_mailboxes" USING btree ("org_id","campaign_id","mailbox_id");--> statement-breakpoint
CREATE INDEX "campaigns_org_id_idx" ON "campaigns" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "campaigns_org_status_idx" ON "campaigns" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "contact_assignments_campaign_id_idx" ON "contact_assignments" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "contact_assignments_contact_id_idx" ON "contact_assignments" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "contact_assignments_org_id_idx" ON "contact_assignments" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "contact_assignments_org_status_next_send_idx" ON "contact_assignments" USING btree ("org_id","status","next_send_at");--> statement-breakpoint
CREATE INDEX "contact_assignments_contact_campaign_idx" ON "contact_assignments" USING btree ("contact_id","campaign_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contact_assignments_org_campaign_contact_uq" ON "contact_assignments" USING btree ("org_id","campaign_id","contact_id");--> statement-breakpoint
CREATE INDEX "contact_groups_org_id_idx" ON "contact_groups" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "contact_groups_org_name_idx" ON "contact_groups" USING btree ("org_id","name");--> statement-breakpoint
CREATE INDEX "contact_groups_org_created_idx" ON "contact_groups" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_org_email_uq" ON "contacts" USING btree ("org_id","email");--> statement-breakpoint
CREATE INDEX "contacts_org_domain_idx" ON "contacts" USING btree ("org_id","domain");--> statement-breakpoint
CREATE INDEX "contacts_org_bounce_idx" ON "contacts" USING btree ("org_id","bounce_status");--> statement-breakpoint
CREATE INDEX "contacts_org_verification_idx" ON "contacts" USING btree ("org_id","verification_status");--> statement-breakpoint
CREATE INDEX "contacts_org_created_idx" ON "contacts" USING btree ("org_id","created_at","id");--> statement-breakpoint
CREATE INDEX "contacts_custom_vars_gin_idx" ON "contacts" USING gin ("custom_vars");--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_stats_daily_org_campaign_day_uq" ON "campaign_stats_daily" USING btree ("org_id","campaign_id","day");--> statement-breakpoint
CREATE INDEX "campaign_stats_daily_org_campaign_day_idx" ON "campaign_stats_daily" USING btree ("org_id","campaign_id","day");--> statement-breakpoint
CREATE UNIQUE INDEX "email_events_org_dedupe_uq" ON "email_events" USING btree ("org_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "email_events_org_occurred_idx" ON "email_events" USING btree ("org_id","occurred_at");--> statement-breakpoint
CREATE INDEX "email_events_campaign_occurred_idx" ON "email_events" USING btree ("org_id","campaign_id","occurred_at");--> statement-breakpoint
CREATE INDEX "email_events_mailbox_occurred_idx" ON "email_events" USING btree ("org_id","mailbox_id","occurred_at");--> statement-breakpoint
CREATE INDEX "email_events_type_occurred_idx" ON "email_events" USING btree ("org_id","type","occurred_at");--> statement-breakpoint
CREATE INDEX "email_events_message_id_idx" ON "email_events" USING btree ("message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mailbox_stats_daily_org_mailbox_day_uq" ON "mailbox_stats_daily" USING btree ("org_id","mailbox_id","day");--> statement-breakpoint
CREATE INDEX "mailbox_stats_daily_org_mailbox_day_idx" ON "mailbox_stats_daily" USING btree ("org_id","mailbox_id","day");--> statement-breakpoint
CREATE UNIQUE INDEX "org_stats_daily_org_day_uq" ON "org_stats_daily" USING btree ("org_id","day");--> statement-breakpoint
CREATE INDEX "org_stats_daily_org_day_idx" ON "org_stats_daily" USING btree ("org_id","day");--> statement-breakpoint
CREATE UNIQUE INDEX "tracked_links_token_uq" ON "tracked_links" USING btree ("token");--> statement-breakpoint
CREATE INDEX "tracked_links_org_campaign_idx" ON "tracked_links" USING btree ("org_id","campaign_id");--> statement-breakpoint
CREATE INDEX "mailboxes_org_id_idx" ON "mailboxes" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "mailboxes_status_idx" ON "mailboxes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mailboxes_org_status_idx" ON "mailboxes" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "mailboxes_org_archived_idx" ON "mailboxes" USING btree ("org_id","archived_at");--> statement-breakpoint
CREATE INDEX "mailboxes_ramp_due_idx" ON "mailboxes" USING btree ("ramp_enabled","ramp_next_check_at");--> statement-breakpoint
CREATE INDEX "notification_prefs_org_user_idx" ON "notification_prefs" USING btree ("org_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_prefs_org_user_unique" ON "notification_prefs" USING btree ("org_id","user_id");--> statement-breakpoint
CREATE INDEX "notifications_org_id_idx" ON "notifications" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "notifications_user_id_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invitations_organization_id_idx" ON "invitations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitations_email_idx" ON "invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "members_organization_id_idx" ON "members" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "members_user_id_idx" ON "members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "members_org_user_idx" ON "members" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "organizations_slug_idx" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "thread_reads_org_user_idx" ON "thread_reads" USING btree ("org_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "thread_reads_org_user_thread_idx" ON "thread_reads" USING btree ("org_id","user_id","thread_id");--> statement-breakpoint
CREATE INDEX "threads_org_id_idx" ON "threads" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "threads_org_direction_idx" ON "threads" USING btree ("org_id","direction");--> statement-breakpoint
CREATE INDEX "threads_campaign_id_idx" ON "threads" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "threads_campaign_direction_idx" ON "threads" USING btree ("campaign_id","direction");--> statement-breakpoint
CREATE INDEX "threads_contact_id_idx" ON "threads" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "threads_message_id_idx" ON "threads" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "threads_org_message_id_idx" ON "threads" USING btree ("org_id","message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "threads_org_client_request_idx" ON "threads" USING btree ("org_id","client_request_id");--> statement-breakpoint
CREATE INDEX "threads_org_provider_thread_idx" ON "threads" USING btree ("org_id","provider_thread_id");--> statement-breakpoint
CREATE POLICY "audit_logs_app_tenant" ON "audit_logs" AS PERMISSIVE FOR ALL TO "samrian_app" USING (org_id = nullif(current_setting('app.org_id', true), '')) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), ''));--> statement-breakpoint
CREATE POLICY "audit_logs_worker_tenant" ON "audit_logs" AS PERMISSIVE FOR ALL TO "samrian_worker" USING (org_id = nullif(current_setting('app.org_id', true), '')) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), ''));--> statement-breakpoint
CREATE POLICY "audit_logs_worker_system_read" ON "audit_logs" AS PERMISSIVE FOR SELECT TO "samrian_worker" USING (current_setting('app.actor_type', true) = 'system');--> statement-breakpoint
CREATE POLICY "org_settings_app_tenant" ON "org_settings" AS PERMISSIVE FOR ALL TO "samrian_app" USING (org_id = nullif(current_setting('app.org_id', true), '')) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), ''));--> statement-breakpoint
CREATE POLICY "org_settings_worker_tenant" ON "org_settings" AS PERMISSIVE FOR ALL TO "samrian_worker" USING (org_id = nullif(current_setting('app.org_id', true), '')) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), ''));--> statement-breakpoint
CREATE POLICY "org_settings_worker_system_read" ON "org_settings" AS PERMISSIVE FOR SELECT TO "samrian_worker" USING (current_setting('app.actor_type', true) = 'system');--> statement-breakpoint
CREATE POLICY "sender_domains_app_tenant" ON "sender_domains" AS PERMISSIVE FOR ALL TO "samrian_app" USING (org_id = nullif(current_setting('app.org_id', true), '')) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), ''));--> statement-breakpoint
CREATE POLICY "sender_domains_worker_tenant" ON "sender_domains" AS PERMISSIVE FOR ALL TO "samrian_worker" USING (org_id = nullif(current_setting('app.org_id', true), '')) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), ''));--> statement-breakpoint
CREATE POLICY "sender_domains_worker_system_read" ON "sender_domains" AS PERMISSIVE FOR SELECT TO "samrian_worker" USING (current_setting('app.actor_type', true) = 'system');--> statement-breakpoint
CREATE POLICY "api_idempotency_app_tenant" ON "api_idempotency" AS PERMISSIVE FOR ALL TO "samrian_app" USING (org_id = nullif(current_setting('app.org_id', true), '')) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), ''));--> statement-breakpoint
CREATE POLICY "api_idempotency_worker_tenant" ON "api_idempotency" AS PERMISSIVE FOR ALL TO "samrian_worker" USING (org_id = nullif(current_setting('app.org_id', true), '')) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), ''));--> statement-breakpoint
CREATE POLICY "api_idempotency_worker_system_read" ON "api_idempotency" AS PERMISSIVE FOR SELECT TO "samrian_worker" USING (current_setting('app.actor_type', true) = 'system');--> statement-breakpoint
CREATE POLICY "blocklist_app_tenant" ON "blocklist" AS PERMISSIVE FOR ALL TO "samrian_app" USING (org_id = nullif(current_setting('app.org_id', true), '')) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), ''));--> statement-breakpoint
CREATE POLICY "blocklist_worker_tenant" ON "blocklist" AS PERMISSIVE FOR ALL TO "samrian_worker" USING (org_id = nullif(current_setting('app.org_id', true), '')) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), ''));--> statement-breakpoint
CREATE POLICY "blocklist_worker_system_read" ON "blocklist" AS PERMISSIVE FOR SELECT TO "samrian_worker" USING (current_setting('app.actor_type', true) = 'system');--> statement-breakpoint
CREATE POLICY "campaign_mailboxes_app_tenant" ON "campaign_mailboxes" AS PERMISSIVE FOR ALL TO "samrian_app" USING (org_id = nullif(current_setting('app.org_id', true), '')) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), ''));--> statement-breakpoint
CREATE POLICY "campaign_mailboxes_worker_tenant" ON "campaign_mailboxes" AS PERMISSIVE FOR ALL TO "samrian_worker" USING (org_id = nullif(current_setting('app.org_id', true), '')) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), ''));--> statement-breakpoint
CREATE POLICY "campaign_mailboxes_worker_system_read" ON "campaign_mailboxes" AS PERMISSIVE FOR SELECT TO "samrian_worker" USING (current_setting('app.actor_type', true) = 'system');--> statement-breakpoint
CREATE POLICY "campaign_mailboxes_worker_system_update" ON "campaign_mailboxes" AS PERMISSIVE FOR UPDATE TO "samrian_worker" USING (current_setting('app.actor_type', true) = 'system') WITH CHECK (current_setting('app.actor_type', true) = 'system');--> statement-breakpoint
CREATE POLICY "campaigns_app_tenant" ON "campaigns" AS PERMISSIVE FOR ALL TO "samrian_app" USING (org_id = nullif(current_setting('app.org_id', true), '')) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), ''));--> statement-breakpoint
CREATE POLICY "campaigns_worker_tenant" ON "campaigns" AS PERMISSIVE FOR ALL TO "samrian_worker" USING (org_id = nullif(current_setting('app.org_id', true), '')) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), ''));--> statement-breakpoint
CREATE POLICY "campaigns_worker_system_read" ON "campaigns" AS PERMISSIVE FOR SELECT TO "samrian_worker" USING (current_setting('app.actor_type', true) = 'system');--> statement-breakpoint
CREATE POLICY "contact_assignments_app_tenant" ON "contact_assignments" AS PERMISSIVE FOR ALL TO "samrian_app" USING (org_id = nullif(current_setting('app.org_id', true), '')) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), ''));--> statement-breakpoint
CREATE POLICY "contact_assignments_worker_tenant" ON "contact_assignments" AS PERMISSIVE FOR ALL TO "samrian_worker" USING (org_id = nullif(current_setting('app.org_id', true), '')) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), ''));--> statement-breakpoint
CREATE POLICY "contact_assignments_worker_system_read" ON "contact_assignments" AS PERMISSIVE FOR SELECT TO "samrian_worker" USING (current_setting('app.actor_type', true) = 'system');--> statement-breakpoint
CREATE POLICY "contact_assignments_worker_system_update" ON "contact_assignments" AS PERMISSIVE FOR UPDATE TO "samrian_worker" USING (current_setting('app.actor_type', true) = 'system') WITH CHECK (current_setting('app.actor_type', true) = 'system');--> statement-breakpoint
CREATE POLICY "contact_groups_app_tenant" ON "contact_groups" AS PERMISSIVE FOR ALL TO "samrian_app" USING (org_id = nullif(current_setting('app.org_id', true), '')) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), ''));--> statement-breakpoint
CREATE POLICY "contact_groups_worker_tenant" ON "contact_groups" AS PERMISSIVE FOR ALL TO "samrian_worker" USING (org_id = nullif(current_setting('app.org_id', true), '')) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), ''));--> statement-breakpoint
CREATE POLICY "contact_groups_worker_system_read" ON "contact_groups" AS PERMISSIVE FOR SELECT TO "samrian_worker" USING (current_setting('app.actor_type', true) = 'system');--> statement-breakpoint
CREATE POLICY "contacts_app_tenant" ON "contacts" AS PERMISSIVE FOR ALL TO "samrian_app" USING (org_id = nullif(current_setting('app.org_id', true), '')) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), ''));--> statement-breakpoint
CREATE POLICY "contacts_worker_tenant" ON "contacts" AS PERMISSIVE FOR ALL TO "samrian_worker" USING (org_id = nullif(current_setting('app.org_id', true), '')) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), ''));--> statement-breakpoint
CREATE POLICY "contacts_worker_system_read" ON "contacts" AS PERMISSIVE FOR SELECT TO "samrian_worker" USING (current_setting('app.actor_type', true) = 'system');--> statement-breakpoint
CREATE POLICY "campaign_stats_daily_app_tenant" ON "campaign_stats_daily" AS PERMISSIVE FOR ALL TO "samrian_app" USING (org_id = nullif(current_setting('app.org_id', true), '')) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), ''));--> statement-breakpoint
CREATE POLICY "campaign_stats_daily_worker_tenant" ON "campaign_stats_daily" AS PERMISSIVE FOR ALL TO "samrian_worker" USING (org_id = nullif(current_setting('app.org_id', true), '')) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), ''));--> statement-breakpoint
CREATE POLICY "campaign_stats_daily_worker_system_read" ON "campaign_stats_daily" AS PERMISSIVE FOR SELECT TO "samrian_worker" USING (current_setting('app.actor_type', true) = 'system');--> statement-breakpoint
CREATE POLICY "email_events_app_tenant" ON "email_events" AS PERMISSIVE FOR ALL TO "samrian_app" USING (org_id = nullif(current_setting('app.org_id', true), '')) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), ''));--> statement-breakpoint
CREATE POLICY "email_events_worker_tenant" ON "email_events" AS PERMISSIVE FOR ALL TO "samrian_worker" USING (org_id = nullif(current_setting('app.org_id', true), '')) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), ''));--> statement-breakpoint
CREATE POLICY "email_events_worker_system_read" ON "email_events" AS PERMISSIVE FOR SELECT TO "samrian_worker" USING (current_setting('app.actor_type', true) = 'system');--> statement-breakpoint
CREATE POLICY "mailbox_stats_daily_app_tenant" ON "mailbox_stats_daily" AS PERMISSIVE FOR ALL TO "samrian_app" USING (org_id = nullif(current_setting('app.org_id', true), '')) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), ''));--> statement-breakpoint
CREATE POLICY "mailbox_stats_daily_worker_tenant" ON "mailbox_stats_daily" AS PERMISSIVE FOR ALL TO "samrian_worker" USING (org_id = nullif(current_setting('app.org_id', true), '')) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), ''));--> statement-breakpoint
CREATE POLICY "mailbox_stats_daily_worker_system_read" ON "mailbox_stats_daily" AS PERMISSIVE FOR SELECT TO "samrian_worker" USING (current_setting('app.actor_type', true) = 'system');--> statement-breakpoint
CREATE POLICY "org_stats_daily_app_tenant" ON "org_stats_daily" AS PERMISSIVE FOR ALL TO "samrian_app" USING (org_id = nullif(current_setting('app.org_id', true), '')) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), ''));--> statement-breakpoint
CREATE POLICY "org_stats_daily_worker_tenant" ON "org_stats_daily" AS PERMISSIVE FOR ALL TO "samrian_worker" USING (org_id = nullif(current_setting('app.org_id', true), '')) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), ''));--> statement-breakpoint
CREATE POLICY "org_stats_daily_worker_system_read" ON "org_stats_daily" AS PERMISSIVE FOR SELECT TO "samrian_worker" USING (current_setting('app.actor_type', true) = 'system');--> statement-breakpoint
CREATE POLICY "tracked_links_app_token_read" ON "tracked_links" AS PERMISSIVE FOR SELECT TO "samrian_app" USING (token = nullif(current_setting('app.tracking_token', true), ''));--> statement-breakpoint
CREATE POLICY "tracked_links_app_tenant" ON "tracked_links" AS PERMISSIVE FOR ALL TO "samrian_app" USING (org_id = nullif(current_setting('app.org_id', true), '')) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), ''));--> statement-breakpoint
CREATE POLICY "tracked_links_worker_tenant" ON "tracked_links" AS PERMISSIVE FOR ALL TO "samrian_worker" USING (org_id = nullif(current_setting('app.org_id', true), '')) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), ''));--> statement-breakpoint
CREATE POLICY "tracked_links_worker_system_read" ON "tracked_links" AS PERMISSIVE FOR SELECT TO "samrian_worker" USING (current_setting('app.actor_type', true) = 'system');--> statement-breakpoint
CREATE POLICY "mailboxes_app_tenant" ON "mailboxes" AS PERMISSIVE FOR ALL TO "samrian_app" USING (org_id = nullif(current_setting('app.org_id', true), '')) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), ''));--> statement-breakpoint
CREATE POLICY "mailboxes_worker_tenant" ON "mailboxes" AS PERMISSIVE FOR ALL TO "samrian_worker" USING (org_id = nullif(current_setting('app.org_id', true), '')) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), ''));--> statement-breakpoint
CREATE POLICY "mailboxes_worker_system_read" ON "mailboxes" AS PERMISSIVE FOR SELECT TO "samrian_worker" USING (current_setting('app.actor_type', true) = 'system');--> statement-breakpoint
CREATE POLICY "mailboxes_worker_system_update" ON "mailboxes" AS PERMISSIVE FOR UPDATE TO "samrian_worker" USING (current_setting('app.actor_type', true) = 'system') WITH CHECK (current_setting('app.actor_type', true) = 'system');--> statement-breakpoint
CREATE POLICY "notification_prefs_app_tenant" ON "notification_prefs" AS PERMISSIVE FOR ALL TO "samrian_app" USING (org_id = nullif(current_setting('app.org_id', true), '')) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), ''));--> statement-breakpoint
CREATE POLICY "notification_prefs_worker_tenant" ON "notification_prefs" AS PERMISSIVE FOR ALL TO "samrian_worker" USING (org_id = nullif(current_setting('app.org_id', true), '')) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), ''));--> statement-breakpoint
CREATE POLICY "notification_prefs_worker_system_read" ON "notification_prefs" AS PERMISSIVE FOR SELECT TO "samrian_worker" USING (current_setting('app.actor_type', true) = 'system');--> statement-breakpoint
CREATE POLICY "notifications_app_tenant" ON "notifications" AS PERMISSIVE FOR ALL TO "samrian_app" USING (org_id = nullif(current_setting('app.org_id', true), '')) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), ''));--> statement-breakpoint
CREATE POLICY "notifications_worker_tenant" ON "notifications" AS PERMISSIVE FOR ALL TO "samrian_worker" USING (org_id = nullif(current_setting('app.org_id', true), '')) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), ''));--> statement-breakpoint
CREATE POLICY "notifications_worker_system_read" ON "notifications" AS PERMISSIVE FOR SELECT TO "samrian_worker" USING (current_setting('app.actor_type', true) = 'system');--> statement-breakpoint
CREATE POLICY "thread_reads_app_tenant" ON "thread_reads" AS PERMISSIVE FOR ALL TO "samrian_app" USING (org_id = nullif(current_setting('app.org_id', true), '')) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), ''));--> statement-breakpoint
CREATE POLICY "thread_reads_worker_tenant" ON "thread_reads" AS PERMISSIVE FOR ALL TO "samrian_worker" USING (org_id = nullif(current_setting('app.org_id', true), '')) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), ''));--> statement-breakpoint
CREATE POLICY "thread_reads_worker_system_read" ON "thread_reads" AS PERMISSIVE FOR SELECT TO "samrian_worker" USING (current_setting('app.actor_type', true) = 'system');--> statement-breakpoint
CREATE POLICY "threads_app_tenant" ON "threads" AS PERMISSIVE FOR ALL TO "samrian_app" USING (org_id = nullif(current_setting('app.org_id', true), '')) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), ''));--> statement-breakpoint
CREATE POLICY "threads_worker_tenant" ON "threads" AS PERMISSIVE FOR ALL TO "samrian_worker" USING (org_id = nullif(current_setting('app.org_id', true), '')) WITH CHECK (org_id = nullif(current_setting('app.org_id', true), ''));--> statement-breakpoint
CREATE POLICY "threads_worker_system_read" ON "threads" AS PERMISSIVE FOR SELECT TO "samrian_worker" USING (current_setting('app.actor_type', true) = 'system');
