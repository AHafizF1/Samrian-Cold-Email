ALTER TABLE "threads" ADD COLUMN "provider_message_id" text;--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "attachments" jsonb;--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "provider_url" text;