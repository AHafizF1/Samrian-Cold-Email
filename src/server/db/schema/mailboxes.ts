import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { mailboxProviders, mailboxStatuses, rampStatuses } from "./constants";
import { tenantPolicies } from "../rls";

export const mailboxProvider = pgEnum("mailbox_provider", mailboxProviders);
export const mailboxStatus = pgEnum("mailbox_status", mailboxStatuses);
export const rampStatus = pgEnum("ramp_status", rampStatuses);

export const mailboxes = pgTable(
  "mailboxes",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    name: text("name").notNull(),
    provider: mailboxProvider("provider").notNull(),
    smtpHost: text("smtp_host"),
    smtpPort: integer("smtp_port"),
    imapHost: text("imap_host"),
    imapPort: integer("imap_port"),
    username: text("username"),
    encryptedPassword: text("encrypted_password"),
    encryptedRefreshToken: text("encrypted_refresh_token"),
    encryptedAccessToken: text("encrypted_access_token"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    userEmail: text("user_email"),
    dailySendLimit: integer("daily_send_limit").notNull(),
    emailsSentToday: integer("emails_sent_today").notNull().default(0),
    reservedSends: integer("reserved_sends").notNull().default(0),
    status: mailboxStatus("status").notNull().default("active"),
    lastPolledAt: timestamp("last_polled_at", { withTimezone: true }),
    lastSuccessfulSendAt: timestamp("last_successful_send_at", { withTimezone: true }),
    lastConnectionTestAt: timestamp("last_connection_test_at", { withTimezone: true }),
    lastConnectionError: text("last_connection_error"),
    lastTokenRefreshAt: timestamp("last_token_refresh_at", { withTimezone: true }),
    lastTokenRefreshError: text("last_token_refresh_error"),
    providerLimitCode: text("provider_limit_code"),
    providerLimitResetAt: timestamp("provider_limit_reset_at", { withTimezone: true }),
    rampEnabled: boolean("ramp_enabled").notNull().default(false),
    rampStatus: rampStatus("ramp_status").notNull().default("disabled"),
    rampStartedAt: timestamp("ramp_started_at", { withTimezone: true }),
    rampUpdatedAt: timestamp("ramp_updated_at", { withTimezone: true }),
    rampCurrentLimit: integer("ramp_current_limit"),
    rampTargetLimit: integer("ramp_target_limit").notNull().default(30),
    rampIncrement: integer("ramp_increment").notNull().default(5),
    rampNextCheckAt: timestamp("ramp_next_check_at", { withTimezone: true }),
    rampHoldUntil: timestamp("ramp_hold_until", { withTimezone: true }),
    rampReason: text("ramp_reason"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("mailboxes_org_id_idx").on(table.orgId),
    index("mailboxes_status_idx").on(table.status),
    index("mailboxes_org_status_idx").on(table.orgId, table.status),
    index("mailboxes_org_archived_idx").on(table.orgId, table.archivedAt),
    index("mailboxes_ramp_due_idx").on(table.rampEnabled, table.rampNextCheckAt),
    ...tenantPolicies("mailboxes", { systemUpdate: true }),
  ]
);

export const sendReservations = pgTable(
  "send_reservations",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    mailboxId: text("mailbox_id").notNull(),
    assignmentId: text("assignment_id").notNull(),
    stepNumber: integer("step_number").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("send_reservations_assignment_step_uq").on(
      table.orgId,
      table.assignmentId,
      table.stepNumber
    ),
    index("send_reservations_mailbox_expiry_idx").on(table.orgId, table.mailboxId, table.expiresAt),
    ...tenantPolicies("send_reservations", { systemUpdate: true }),
  ]
);
