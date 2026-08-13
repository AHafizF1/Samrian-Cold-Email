import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import {
  assignmentStatuses,
  campaignStatuses,
  groupLogicValues,
  groupOperators,
} from "./constants";
import { tenantPolicies } from "../rls";

export const campaignStatus = pgEnum("campaign_status", campaignStatuses);
export const assignmentStatus = pgEnum("assignment_status", assignmentStatuses);
export const groupLogic = pgEnum("group_logic", groupLogicValues);
export const groupOperator = pgEnum("group_operator", groupOperators);

export const campaigns = pgTable(
  "campaigns",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    name: text("name").notNull(),
    status: campaignStatus("status").notNull().default("draft"),
    schedule: jsonb("schedule").notNull(),
    steps: jsonb("steps").notNull(),
    mailboxRotation: text("mailbox_rotation"),
    targetGroupId: text("target_group_id"),
    targetContactIds: jsonb("target_contact_ids"),
    listUnsubscribeEnabled: boolean("list_unsubscribe_enabled"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("campaigns_org_id_idx").on(table.orgId),
    index("campaigns_org_status_idx").on(table.orgId, table.status),
    ...tenantPolicies("campaigns"),
  ]
);

export const campaignMailboxes = pgTable(
  "campaign_mailboxes",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id").notNull(),
    mailboxId: text("mailbox_id").notNull(),
    orgId: text("org_id").notNull(),
    status: text("status").notNull().default("enabled"),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (table) => [
    index("campaign_mailboxes_campaign_id_idx").on(table.campaignId),
    index("campaign_mailboxes_mailbox_id_idx").on(table.mailboxId),
    index("campaign_mailboxes_org_id_idx").on(table.orgId),
    uniqueIndex("campaign_mailboxes_org_campaign_mailbox_uq").on(
      table.orgId,
      table.campaignId,
      table.mailboxId
    ),
    ...tenantPolicies("campaign_mailboxes", { systemUpdate: true }),
  ]
);

export const contactAssignments = pgTable(
  "contact_assignments",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id").notNull(),
    contactId: text("contact_id").notNull(),
    orgId: text("org_id").notNull(),
    status: assignmentStatus("status").notNull().default("active"),
    currentStep: integer("current_step").notNull().default(0),
    assignedMailboxId: text("assigned_mailbox_id"),
    lastEmailSentAt: timestamp("last_email_sent_at", { withTimezone: true }),
    nextSendAt: timestamp("next_send_at", { withTimezone: true }),
    lastEnqueuedAt: timestamp("last_enqueued_at", { withTimezone: true }),
    lastRepliedAt: timestamp("last_replied_at", { withTimezone: true }),
    stepDelays: jsonb("step_delays"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("contact_assignments_campaign_id_idx").on(table.campaignId),
    index("contact_assignments_contact_id_idx").on(table.contactId),
    index("contact_assignments_org_id_idx").on(table.orgId),
    index("contact_assignments_org_status_next_send_idx").on(
      table.orgId,
      table.status,
      table.nextSendAt
    ),
    index("contact_assignments_contact_campaign_idx").on(table.contactId, table.campaignId),
    uniqueIndex("contact_assignments_org_campaign_contact_uq").on(
      table.orgId,
      table.campaignId,
      table.contactId
    ),
    ...tenantPolicies("contact_assignments", { systemUpdate: true }),
  ]
);

export const contactGroups = pgTable(
  "contact_groups",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    rules: jsonb("rules").notNull(),
    logic: groupLogic("logic").notNull(),
    isDynamic: boolean("is_dynamic").notNull(),
    contactIds: jsonb("contact_ids"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: text("created_by").notNull(),
  },
  (table) => [
    index("contact_groups_org_id_idx").on(table.orgId),
    index("contact_groups_org_name_idx").on(table.orgId, table.name),
    index("contact_groups_org_created_idx").on(table.orgId, table.createdAt),
    ...tenantPolicies("contact_groups"),
  ]
);
