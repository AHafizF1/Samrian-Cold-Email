import { beforeEach, describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";

import { createDb } from "../../src/server/db/db";
import { blocklist, contacts } from "../../src/server/db/schema";
import { PostgresBlocklistRepo, PostgresContactRepo } from "../../src/server/repos";

const testUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testUrl)("postgres contact repo", () => {
  const db = createDb({ driver: "postgres-js", url: testUrl! }).client;
  const repo = new PostgresContactRepo(db);

  beforeEach(async () => {
    await db.delete(contacts).where(eq(contacts.orgId, "org_repo"));
    await db.delete(contacts).where(eq(contacts.orgId, "org_other"));
  });

  test("creates, lists, searches, updates, and deletes contacts per org", async () => {
    const created = await repo.create({
      orgId: "org_repo",
      email: "Ada@Example.com",
      customVars: { firstName: "Ada" },
      timezone: "UTC",
    });
    await repo.create({ orgId: "org_other", email: "ada@example.com" });

    await expect(repo.getById(created.id, "org_repo")).resolves.toMatchObject({
      email: "ada@example.com",
      customVars: { firstName: "Ada" },
    });
    await expect(repo.getById(created.id, "org_other")).resolves.toBeNull();
    await expect(repo.list("org_repo")).resolves.toHaveLength(1);
    await expect(repo.search("org_repo", "ada")).resolves.toHaveLength(1);

    await expect(
      repo.update(created.id, "org_repo", { bounceStatus: "hard" })
    ).resolves.toMatchObject({
      bounceStatus: "hard",
    });
    await expect(repo.remove(created.id, "org_repo")).resolves.toBe(true);
    await expect(repo.getById(created.id, "org_repo")).resolves.toBeNull();
  });

  test("lists stable bounded pages without crossing organizations", async () => {
    await repo.create({ orgId: "org_repo", email: "one@example.com" });
    await repo.create({ orgId: "org_repo", email: "two@example.com" });
    await repo.create({ orgId: "org_repo", email: "three@example.com" });
    await repo.create({ orgId: "org_other", email: "hidden@example.com" });

    const first = await repo.listPage("org_repo", { limit: 2 });
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).toBeDefined();

    const second = await repo.listPage("org_repo", { limit: 2, cursor: first.nextCursor });
    expect(second.items).toHaveLength(1);
    expect(new Set([...first.items, ...second.items].map(({ email }) => email))).toEqual(
      new Set(["one@example.com", "two@example.com", "three@example.com"])
    );
  });
});

describe.skipIf(!testUrl)("postgres blocklist repo", () => {
  const db = createDb({ driver: "postgres-js", url: testUrl! }).client;
  const repo = new PostgresBlocklistRepo(db);

  beforeEach(async () => {
    await db.delete(blocklist).where(eq(blocklist.orgId, "org_repo"));
    await db.delete(blocklist).where(eq(blocklist.orgId, "org_other"));
  });

  test("adds, lists, checks, and removes blocked emails per org", async () => {
    await repo.add({ orgId: "org_repo", email: "Blocked@Example.com", reason: "manual" });
    await repo.add({ orgId: "org_repo", email: "blocked@example.com", reason: "manual" });

    await expect(repo.isBlocked("blocked@example.com", "org_repo")).resolves.toBe(true);
    await expect(repo.isBlocked("blocked@example.com", "org_other")).resolves.toBe(false);
    await expect(repo.list("org_repo")).resolves.toHaveLength(1);
    await expect(repo.remove("blocked@example.com", "org_repo")).resolves.toBe(true);
    await expect(repo.isBlocked("blocked@example.com", "org_repo")).resolves.toBe(false);
  });
});
