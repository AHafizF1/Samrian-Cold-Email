import { boolean, index, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { tenantPolicies } from "../rls";

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    userId: text("user_id"),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    data: jsonb("data"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("notifications_org_id_idx").on(table.orgId),
    index("notifications_user_id_idx").on(table.userId),
    ...tenantPolicies("notifications"),
  ]
);

export const notificationPrefs = pgTable(
  "notification_prefs",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    userId: text("user_id").notNull(),
    replyInAppEnabled: boolean("reply_in_app_enabled").notNull().default(true),
    replyForwardEnabled: boolean("reply_forward_enabled").notNull().default(false),
    replyForwardEmails: jsonb("reply_forward_emails").notNull().default([]),
    browserPushEnabled: boolean("browser_push_enabled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("notification_prefs_org_user_idx").on(table.orgId, table.userId),
    uniqueIndex("notification_prefs_org_user_unique").on(table.orgId, table.userId),
    ...tenantPolicies("notification_prefs"),
  ]
);
