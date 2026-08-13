import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { boolean, integer, jsonb, real } from "drizzle-orm/pg-core";
import { tenantPolicies } from "../rls";

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    userId: text("user_id").notNull(),
    action: text("action").notNull(),
    details: text("details").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("audit_logs_org_id_idx").on(table.orgId), ...tenantPolicies("audit_logs")]
);

export const orgSettings = pgTable(
  "org_settings",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    encryptedMailpoolKey: text("encrypted_mailpool_key"),
    physicalAddress: text("physical_address"),
    defaultSenderName: text("default_sender_name"),
    unsubscribeFooter: text("unsubscribe_footer"),
    unsubscribeMailto: text("unsubscribe_mailto"),
    listUnsubscribeEnabled: boolean("list_unsubscribe_enabled").notNull().default(false),
    clickTrackingEnabled: boolean("click_tracking_enabled").notNull().default(false),
    openTrackingEnabled: boolean("open_tracking_enabled").notNull().default(false),
    bouncePauseRate: real("bounce_pause_rate").notNull().default(0.05),
    unsubscribePauseRate: real("unsubscribe_pause_rate").notNull().default(0.1),
    complaintPauseRate: real("complaint_pause_rate").notNull().default(0.001),
    defaultRampEnabled: boolean("default_ramp_enabled").notNull().default(false),
    defaultRampTarget: integer("default_ramp_target").notNull().default(30),
    replyReserve: integer("reply_reserve").notNull().default(2),
  },
  (table) => [index("org_settings_org_id_idx").on(table.orgId), ...tenantPolicies("org_settings")]
);

export const senderDomains = pgTable(
  "sender_domains",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    domain: text("domain").notNull(),
    source: text("source").notNull().default("dns"),
    status: text("status").notNull(),
    checks: jsonb("checks").notNull(),
    issues: jsonb("issues").notNull().default([]),
    warnings: jsonb("warnings").notNull().default([]),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("sender_domains_org_id_idx").on(table.orgId),
    index("sender_domains_org_domain_idx").on(table.orgId, table.domain),
    ...tenantPolicies("sender_domains"),
  ]
);
