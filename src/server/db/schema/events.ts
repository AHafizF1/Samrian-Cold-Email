import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { emailEventTypes } from "./constants";
import { tenantPolicies, trackingTokenPolicy } from "../rls";

export const emailEventType = pgEnum("email_event_type", emailEventTypes);

export const emailEvents = pgTable(
  "email_events",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    campaignId: text("campaign_id"),
    contactId: text("contact_id"),
    mailboxId: text("mailbox_id"),
    assignmentId: text("assignment_id"),
    threadId: text("thread_id"),
    messageId: text("message_id"),
    type: emailEventType("type").notNull(),
    stepNumber: integer("step_number"),
    dedupeKey: text("dedupe_key").notNull(),
    metadata: jsonb("metadata"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("email_events_org_dedupe_uq").on(table.orgId, table.dedupeKey),
    index("email_events_org_occurred_idx").on(table.orgId, table.occurredAt),
    index("email_events_campaign_occurred_idx").on(table.orgId, table.campaignId, table.occurredAt),
    index("email_events_mailbox_occurred_idx").on(table.orgId, table.mailboxId, table.occurredAt),
    index("email_events_type_occurred_idx").on(table.orgId, table.type, table.occurredAt),
    index("email_events_message_id_idx").on(table.messageId),
    ...tenantPolicies("email_events"),
  ]
);

export const trackedLinks = pgTable(
  "tracked_links",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    campaignId: text("campaign_id"),
    contactId: text("contact_id"),
    assignmentId: text("assignment_id"),
    threadId: text("thread_id"),
    messageId: text("message_id"),
    token: text("token").notNull(),
    originalUrl: text("original_url").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("tracked_links_token_uq").on(table.token),
    index("tracked_links_org_campaign_idx").on(table.orgId, table.campaignId),
    trackingTokenPolicy(),
    ...tenantPolicies("tracked_links"),
  ]
);

export const orgStatsDaily = pgTable(
  "org_stats_daily",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    day: text("day").notNull(),
    sent: integer("sent").notNull().default(0),
    failed: integer("failed").notNull().default(0),
    replies: integer("replies").notNull().default(0),
    unsubscribes: integer("unsubscribes").notNull().default(0),
    hardBounces: integer("hard_bounces").notNull().default(0),
    softBounces: integer("soft_bounces").notNull().default(0),
    totalClicks: integer("total_clicks").notNull().default(0),
    uniqueClicks: integer("unique_clicks").notNull().default(0),
    totalOpens: integer("total_opens").notNull().default(0),
    uniqueOpens: integer("unique_opens").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("org_stats_daily_org_day_uq").on(table.orgId, table.day),
    index("org_stats_daily_org_day_idx").on(table.orgId, table.day),
    ...tenantPolicies("org_stats_daily"),
  ]
);

export const campaignStatsDaily = pgTable(
  "campaign_stats_daily",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    campaignId: text("campaign_id").notNull(),
    day: text("day").notNull(),
    sent: integer("sent").notNull().default(0),
    failed: integer("failed").notNull().default(0),
    replies: integer("replies").notNull().default(0),
    unsubscribes: integer("unsubscribes").notNull().default(0),
    hardBounces: integer("hard_bounces").notNull().default(0),
    softBounces: integer("soft_bounces").notNull().default(0),
    totalClicks: integer("total_clicks").notNull().default(0),
    uniqueClicks: integer("unique_clicks").notNull().default(0),
    totalOpens: integer("total_opens").notNull().default(0),
    uniqueOpens: integer("unique_opens").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("campaign_stats_daily_org_campaign_day_uq").on(
      table.orgId,
      table.campaignId,
      table.day
    ),
    index("campaign_stats_daily_org_campaign_day_idx").on(table.orgId, table.campaignId, table.day),
    ...tenantPolicies("campaign_stats_daily"),
  ]
);

export const mailboxStatsDaily = pgTable(
  "mailbox_stats_daily",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    mailboxId: text("mailbox_id").notNull(),
    day: text("day").notNull(),
    sent: integer("sent").notNull().default(0),
    failed: integer("failed").notNull().default(0),
    replies: integer("replies").notNull().default(0),
    unsubscribes: integer("unsubscribes").notNull().default(0),
    hardBounces: integer("hard_bounces").notNull().default(0),
    softBounces: integer("soft_bounces").notNull().default(0),
    totalClicks: integer("total_clicks").notNull().default(0),
    uniqueClicks: integer("unique_clicks").notNull().default(0),
    totalOpens: integer("total_opens").notNull().default(0),
    uniqueOpens: integer("unique_opens").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("mailbox_stats_daily_org_mailbox_day_uq").on(
      table.orgId,
      table.mailboxId,
      table.day
    ),
    index("mailbox_stats_daily_org_mailbox_day_idx").on(table.orgId, table.mailboxId, table.day),
    ...tenantPolicies("mailbox_stats_daily"),
  ]
);
