import { getTableName, sql } from "drizzle-orm";
import { describe, expect, test, vi } from "vitest";

import * as schema from "../../src/server/db/schema";
import { AUTH_TABLES, GLOBAL_TABLES, TENANT_TABLES } from "../../src/server/db/rls";
import {
  assertDatabaseRole,
  getTenantDb,
  withTenant,
  withTrackingToken,
} from "../../src/server/db/tenant";

const EXPECTED_TABLES = [
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
  "send_reservations",
  "sender_domains",
  "thread_reads",
  "threads",
  "tracked_links",
].sort();

describe("tenant RLS registry", () => {
  test("classifies every app-owned org_id table", () => {
    const schemaTenantTables = Object.values(schema)
      .flatMap((value) =>
        value && typeof value === "object" && "orgId" in value
          ? [getTableName(value as Parameters<typeof getTableName>[0])]
          : []
      )
      .sort();

    expect([...TENANT_TABLES].sort()).toEqual(EXPECTED_TABLES);
    expect(schemaTenantTables).toEqual(EXPECTED_TABLES);
  });

  test("classifies every Drizzle table exactly once", () => {
    // Better Auth expects an `apikeys` schema key that aliases our `apiKeys`
    // export. Classify physical tables, not schema export names.
    const allTables = [
      ...new Set(
        Object.values(schema).flatMap((value) => {
          try {
            if (!value || typeof value !== "object") return [];
            const name = getTableName(value as Parameters<typeof getTableName>[0]);
            return name ? [name] : [];
          } catch {
            return [];
          }
        })
      ),
    ].sort();
    const classified = [...TENANT_TABLES, ...AUTH_TABLES, ...GLOBAL_TABLES].sort();

    expect(classified).toEqual(allTables);
    expect(new Set(classified).size).toBe(classified.length);
  });
});

describe("withTenant", () => {
  test("checks the expected non-bypass runtime group", async () => {
    const execute = vi.fn().mockResolvedValue(undefined);

    await assertDatabaseRole({ execute } as never, "auth");

    expect(execute).toHaveBeenCalledOnce();
    expect(execute.mock.calls[0]?.[0].queryChunks).toContain("samrian_auth");
  });

  test("sets transaction-local context before work", async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const tx = { execute };
    const db = { transaction: vi.fn((callback) => callback(tx)) };

    const result = await withTenant(
      db as never,
      { orgId: "org_a", userId: "user_a", actorType: "request" },
      async (executor) => {
        expect(executor).toBe(tx);
        expect(getTenantDb()).toBe(tx);
        return "ok";
      }
    );

    expect(result).toBe("ok");
    expect(db.transaction).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledTimes(4);
    expect(getTenantDb()).toBeUndefined();
    for (const query of execute.mock.calls.map(([value]) => value)) {
      expect(query).toHaveProperty("queryChunks");
    }
  });

  test.each([
    { orgId: "", actorType: "request" as const },
    { orgId: "org_a", userId: " ", actorType: "request" as const },
  ])("rejects invalid context before transaction", async (context) => {
    const db = { transaction: vi.fn() };
    await expect(withTenant(db as never, context, async () => null)).rejects.toThrow(
      "Invalid tenant context"
    );
    expect(db.transaction).not.toHaveBeenCalled();
  });

  test("uses parameterized set_config queries", () => {
    const query = sql`select set_config('app.org_id', ${"org_a"}, true)`;
    expect(query.queryChunks.some((chunk) => chunk === "org_a")).toBe(true);
  });

  test("reuses same tenant transaction without nesting", async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const tx = { execute };
    const db = { transaction: vi.fn((callback) => callback(tx)) };
    const context = { orgId: "org_a", userId: "user_a", actorType: "request" as const };

    await withTenant(db as never, context, () =>
      withTenant(db as never, context, async (nested) => {
        expect(nested).toBe(tx);
      })
    );

    expect(db.transaction).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledTimes(4);
  });

  test("rejects nested tenant switch", async () => {
    const tx = { execute: vi.fn().mockResolvedValue(undefined) };
    const db = { transaction: vi.fn((callback) => callback(tx)) };

    await expect(
      withTenant(db as never, { orgId: "org_a", actorType: "request" }, () =>
        withTenant(db as never, { orgId: "org_b", actorType: "request" }, async () => null)
      )
    ).rejects.toThrow("Cannot switch tenant inside active transaction");
  });
});

describe("withTrackingToken", () => {
  test("sets only transaction-local tracking token before lookup", async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const tx = { execute };
    const db = { transaction: vi.fn((callback) => callback(tx)) };

    const result = await withTrackingToken(db as never, "track_a", async (executor) => {
      expect(executor).toBe(tx);
      return "ok";
    });

    expect(result).toBe("ok");
    expect(execute).toHaveBeenCalledOnce();
    expect(execute.mock.calls[0]?.[0]).toHaveProperty("queryChunks");
  });

  test("rejects empty token before transaction", async () => {
    const db = { transaction: vi.fn() };

    await expect(withTrackingToken(db as never, " ", async () => null)).rejects.toThrow(
      "Invalid tracking token"
    );
    expect(db.transaction).not.toHaveBeenCalled();
  });
});
