import { index, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { threadDirections } from "./constants";
import { tenantPolicies } from "../rls";

export const threadDirection = pgEnum("thread_direction", threadDirections);

export const threads = pgTable(
  "threads",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    campaignId: text("campaign_id").notNull(),
    contactId: text("contact_id").notNull(),
    mailboxId: text("mailbox_id").notNull(),
    messageId: text("message_id").notNull(),
    providerMessageId: text("provider_message_id"),
    clientRequestId: text("client_request_id"),
    inReplyTo: text("in_reply_to"),
    references: jsonb("references"),
    providerThreadId: text("provider_thread_id"),
    classification: text("classification"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    rawHeaders: jsonb("raw_headers"),
    direction: threadDirection("direction").notNull(),
    from: text("from").notNull(),
    to: jsonb("to").notNull(),
    subject: text("subject").notNull(),
    textBody: text("text_body"),
    htmlBody: text("html_body"),
    headers: jsonb("headers").notNull().default({}),
    attachments: jsonb("attachments"),
    providerUrl: text("provider_url"),
    emlKey: text("eml_key"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("threads_org_id_idx").on(table.orgId),
    index("threads_org_direction_idx").on(table.orgId, table.direction),
    index("threads_campaign_id_idx").on(table.campaignId),
    index("threads_campaign_direction_idx").on(table.campaignId, table.direction),
    index("threads_contact_id_idx").on(table.contactId),
    index("threads_message_id_idx").on(table.messageId),
    index("threads_org_message_id_idx").on(table.orgId, table.messageId),
    uniqueIndex("threads_org_client_request_idx").on(table.orgId, table.clientRequestId),
    index("threads_org_provider_thread_idx").on(table.orgId, table.providerThreadId),
    ...tenantPolicies("threads"),
  ]
);

export const threadReads = pgTable(
  "thread_reads",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    userId: text("user_id").notNull(),
    threadId: text("thread_id").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("thread_reads_org_user_idx").on(table.orgId, table.userId),
    uniqueIndex("thread_reads_org_user_thread_idx").on(table.orgId, table.userId, table.threadId),
    ...tenantPolicies("thread_reads"),
  ]
);
