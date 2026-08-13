import { index, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { tenantPolicies } from "../rls";

export const apiIdempotency = pgTable(
  "api_idempotency",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    credentialId: text("credential_id").notNull(),
    operationId: text("operation_id").notNull(),
    key: text("key").notNull(),
    fingerprint: text("fingerprint").notNull(),
    state: text("state").notNull().default("processing"),
    result: jsonb("result"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (table) => [
    uniqueIndex("api_idempotency_key_uq").on(
      table.orgId,
      table.credentialId,
      table.operationId,
      table.key
    ),
    index("api_idempotency_expires_idx").on(table.expiresAt),
    ...tenantPolicies("api_idempotency"),
  ]
);
