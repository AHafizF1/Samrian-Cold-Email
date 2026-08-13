import { index, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { blocklistReasons } from "./constants";
import { tenantPolicies } from "../rls";

export const blocklistReason = pgEnum("blocklist_reason", blocklistReasons);

export const blocklist = pgTable(
  "blocklist",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    email: text("email").notNull(),
    reason: blocklistReason("reason").notNull(),
    campaignId: text("campaign_id"),
    unsubscribeToken: text("unsubscribe_token"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("blocklist_org_email_idx").on(table.orgId, table.email),
    index("blocklist_email_idx").on(table.email),
    ...tenantPolicies("blocklist"),
  ]
);
