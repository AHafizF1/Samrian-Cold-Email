import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { createDb } from "../../src/server/db/db";
import { contactAssignments, contacts } from "../../src/server/db/schema";
import { withTenant } from "../../src/server/db/tenant";

const adminUrl = process.env.TEST_DATABASE_URL;
const appUrl = process.env.TEST_APP_DATABASE_URL;
const authUrl = process.env.TEST_AUTH_DATABASE_URL;
const workerUrl = process.env.TEST_WORKER_DATABASE_URL;
const enabled = Boolean(adminUrl && appUrl && authUrl && workerUrl);
const suffix = crypto.randomUUID();
const ids = [`contact_a_${suffix}`, `contact_b_${suffix}`];
const assignmentIds = [`assignment_a_${suffix}`, `assignment_b_${suffix}`];

describe.skipIf(!enabled)("Postgres tenant RLS", () => {
  const admin = createDb({ driver: "postgres-js", url: adminUrl! }).client;
  const app = createDb({ driver: "postgres-js", url: appUrl! }).client;
  const worker = createDb({ driver: "postgres-js", url: workerUrl! }).client;
  const appSql = postgres(appUrl!, { max: 1 });
  const authSql = postgres(authUrl!, { max: 1 });
  const workerSql = postgres(workerUrl!, { max: 1 });

  beforeAll(async () => {
    await admin.insert(contacts).values([
      { id: ids[0], orgId: "org_rls_a", email: `a-${suffix}@example.com`, customVars: {} },
      { id: ids[1], orgId: "org_rls_b", email: `b-${suffix}@example.com`, customVars: {} },
    ]);
    await admin.insert(contactAssignments).values([
      {
        id: assignmentIds[0],
        orgId: "org_rls_a",
        campaignId: `campaign_a_${suffix}`,
        contactId: ids[0],
      },
      {
        id: assignmentIds[1],
        orgId: "org_rls_b",
        campaignId: `campaign_b_${suffix}`,
        contactId: ids[1],
      },
    ]);
  });

  afterAll(async () => {
    await admin.delete(contactAssignments).where(inArray(contactAssignments.id, assignmentIds));
    await admin.delete(contacts).where(inArray(contacts.id, ids));
    await Promise.all([appSql.end(), authSql.end(), workerSql.end()]);
  });

  test("app role sees no tenant rows without context", async () => {
    const rows = await app.select().from(contacts).where(inArray(contacts.id, ids));
    expect(rows).toEqual([]);
  });

  test("app role reads only selected org and rejects cross-org insert", async () => {
    const rows = await withTenant(
      app,
      { orgId: "org_rls_a", userId: "user_a", actorType: "request" },
      (tx) => tx.select().from(contacts).where(inArray(contacts.id, ids))
    );
    expect(rows.map((row) => row.id)).toEqual([ids[0]]);

    await expect(
      withTenant(
        app,
        { orgId: "org_rls_a", userId: "user_a", actorType: "request" },
        async (tx) => {
          await tx.insert(contacts).values({
            id: `contact_wrong_${suffix}`,
            orgId: "org_rls_b",
            email: `wrong-${suffix}@example.com`,
            customVars: {},
          });
        }
      )
    ).rejects.toThrow();

    const [updated, removed] = await withTenant(
      app,
      { orgId: "org_rls_a", userId: "user_a", actorType: "request" },
      async (tx) => {
        const updated = await tx
          .update(contacts)
          .set({ timezone: "UTC" })
          .where(eq(contacts.id, ids[1]))
          .returning();
        const removed = await tx.delete(contacts).where(eq(contacts.id, ids[1])).returning();
        return [updated, removed] as const;
      }
    );
    expect(updated).toEqual([]);
    expect(removed).toEqual([]);
  });

  test("joins cannot recover rows hidden by tenant policies", async () => {
    const rows = await withTenant(
      app,
      { orgId: "org_rls_a", userId: "user_a", actorType: "request" },
      (tx) =>
        tx
          .select({ assignmentId: contactAssignments.id, contactId: contacts.id })
          .from(contactAssignments)
          .innerJoin(contacts, eq(contactAssignments.contactId, contacts.id))
          .where(inArray(contactAssignments.id, assignmentIds))
    );

    expect(rows).toEqual([{ assignmentId: assignmentIds[0], contactId: ids[0] }]);
  });

  test("rollback and pooled concurrent requests do not leak context", async () => {
    const rolledBackId = `contact_rollback_${suffix}`;
    await expect(
      withTenant(
        app,
        { orgId: "org_rls_a", userId: "user_a", actorType: "request" },
        async (tx) => {
          await tx.insert(contacts).values({
            id: rolledBackId,
            orgId: "org_rls_a",
            email: `rollback-${suffix}@example.com`,
            customVars: {},
          });
          throw new Error("rollback");
        }
      )
    ).rejects.toThrow("rollback");
    await expect(
      admin.select().from(contacts).where(eq(contacts.id, rolledBackId))
    ).resolves.toEqual([]);

    const results = await Promise.all(
      Array.from({ length: 12 }, (_, index) => {
        const orgId = index % 2 === 0 ? "org_rls_a" : "org_rls_b";
        const expectedId = index % 2 === 0 ? ids[0] : ids[1];
        return withTenant(app, { orgId, actorType: "request" }, async (tx) => {
          const rows = await tx.select().from(contacts).where(inArray(contacts.id, ids));
          return { expectedId, rows };
        });
      })
    );
    for (const result of results) {
      expect(result.rows.map((row) => row.id)).toEqual([result.expectedId]);
    }
  });

  test("worker role is tenant-scoped unless explicit system context is used", async () => {
    const tenantRows = await withTenant(worker, { orgId: "org_rls_b", actorType: "worker" }, (tx) =>
      tx.select().from(contacts).where(inArray(contacts.id, ids))
    );
    expect(tenantRows.map((row) => row.id)).toEqual([ids[1]]);

    const systemRows = await withTenant(worker, { orgId: "system", actorType: "system" }, (tx) =>
      tx.select().from(contacts).where(inArray(contacts.id, ids))
    );
    expect(systemRows.map((row) => row.id).sort()).toEqual([...ids].sort());
  });

  test("runtime roles cannot bypass their assigned capabilities", async () => {
    const [role] = await appSql<
      [{ rolsuper: boolean; rolbypassrls: boolean; worker_member: boolean }]
    >`
      select rolsuper, rolbypassrls,
        pg_has_role(current_user, 'samrian_worker', 'member') as worker_member
      from pg_roles where rolname = current_user
    `;
    expect(role).toEqual({ rolsuper: false, rolbypassrls: false, worker_member: false });
    await expect(appSql`set role samrian_worker`).rejects.toThrow();
    await expect(appSql`set role postgres`).rejects.toThrow();
    await expect(appSql`alter table contacts disable row level security`).rejects.toThrow();
    await expect(authSql`set role postgres`).rejects.toThrow();
    await expect(authSql`alter table contacts disable row level security`).rejects.toThrow();
    await expect(workerSql`select * from sessions limit 1`).rejects.toThrow();
  });

  test("auth role can access auth tables but no tenant product tables", async () => {
    await expect(authSql`select id from sessions limit 1`).resolves.toBeDefined();
    await expect(authSql`select id from contacts limit 1`).rejects.toThrow();
    await expect(appSql`select id from sessions limit 1`).rejects.toThrow();

    const [role] = await authSql<
      [{ rolsuper: boolean; rolbypassrls: boolean; app_member: boolean; worker_member: boolean }]
    >`
      select rolsuper, rolbypassrls,
        pg_has_role(current_user, 'samrian_app', 'member') as app_member,
        pg_has_role(current_user, 'samrian_worker', 'member') as worker_member
      from pg_roles where rolname = current_user
    `;
    expect(role).toEqual({
      rolsuper: false,
      rolbypassrls: false,
      app_member: false,
      worker_member: false,
    });
  });
});
