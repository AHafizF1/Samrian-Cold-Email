import { index, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { verificationStatuses } from "./constants";
import { tenantPolicies } from "../rls";

export const verificationStatus = pgEnum("verification_status", verificationStatuses);

export const contacts = pgTable(
  "contacts",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    email: text("email").notNull(),
    domain: text("domain"),
    customVars: jsonb("custom_vars").notNull().default({}),
    timezone: text("timezone"),
    bounceStatus: text("bounce_status"),
    verificationStatus: verificationStatus("verification_status"),
    verificationCheckedAt: timestamp("verification_checked_at", { mode: "date" }),
    verificationReason: text("verification_reason"),
    verificationProvider: text("verification_provider"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("contacts_org_email_uq").on(table.orgId, table.email),
    index("contacts_org_domain_idx").on(table.orgId, table.domain),
    index("contacts_org_bounce_idx").on(table.orgId, table.bounceStatus),
    index("contacts_org_verification_idx").on(table.orgId, table.verificationStatus),
    index("contacts_org_created_idx").on(table.orgId, table.createdAt, table.id),
    index("contacts_custom_vars_gin_idx").using("gin", table.customVars),
    ...tenantPolicies("contacts"),
  ]
);
