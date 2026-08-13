import { sql } from "drizzle-orm";
import { pgPolicy, pgRole } from "drizzle-orm/pg-core";

export const appRole = pgRole("samrian_app").existing();
export const authRole = pgRole("samrian_auth").existing();
export const workerRole = pgRole("samrian_worker").existing();

export const AUTH_TABLES = [
  "accounts",
  "apikeys",
  "invitations",
  "jwks",
  "members",
  "organization_roles",
  "organizations",
  "sessions",
  "users",
  "verifications",
] as const;

export const GLOBAL_TABLES = [] as const;

export const TENANT_TABLES = [
  "api_idempotency",
  "audit_logs",
  "blocklist",
  "campaign_mailboxes",
  "campaign_stats_daily",
  "campaigns",
  "contact_assignments",
  "contact_groups",
  "contacts",
  "email_events",
  "mailbox_stats_daily",
  "mailboxes",
  "notification_prefs",
  "notifications",
  "org_settings",
  "org_stats_daily",
  "sender_domains",
  "send_reservations",
  "thread_reads",
  "threads",
  "tracked_links",
] as const;

const matchesTenant = sql`org_id = nullif(current_setting('app.org_id', true), '')`;

export function tenantPolicies(
  table: (typeof TENANT_TABLES)[number],
  options: { systemUpdate?: boolean } = {}
) {
  const policies = [
    pgPolicy(`${table}_app_tenant`, {
      for: "all",
      to: appRole,
      using: matchesTenant,
      withCheck: matchesTenant,
    }),
    pgPolicy(`${table}_worker_tenant`, {
      for: "all",
      to: workerRole,
      using: matchesTenant,
      withCheck: matchesTenant,
    }),
    pgPolicy(`${table}_worker_system_read`, {
      for: "select",
      to: workerRole,
      using: sql`current_setting('app.actor_type', true) = 'system'`,
    }),
  ];

  if (options.systemUpdate) {
    policies.push(
      pgPolicy(`${table}_worker_system_update`, {
        for: "update",
        to: workerRole,
        using: sql`current_setting('app.actor_type', true) = 'system'`,
        withCheck: sql`current_setting('app.actor_type', true) = 'system'`,
      })
    );
  }

  return policies;
}

export function trackingTokenPolicy() {
  return pgPolicy("tracked_links_app_token_read", {
    for: "select",
    to: appRole,
    using: sql`token = nullif(current_setting('app.tracking_token', true), '')`,
  });
}
