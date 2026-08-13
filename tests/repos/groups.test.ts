import { beforeEach, describe, expect, test } from "vitest";
import { inArray } from "drizzle-orm";

import { createDb } from "../../src/server/db/db";
import { contactGroups, contacts } from "../../src/server/db/schema";
import { PostgresContactRepo, PostgresGroupRepo } from "../../src/server/repos";

const testUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testUrl)("postgres group repo", () => {
  const db = createDb({ driver: "postgres-js", url: testUrl! }).client;
  const contactsRepo = new PostgresContactRepo(db);
  const groupsRepo = new PostgresGroupRepo(db);

  beforeEach(async () => {
    const orgIds = ["org_groups", "org_groups_other"];
    await db.delete(contactGroups).where(inArray(contactGroups.orgId, orgIds));
    await db.delete(contacts).where(inArray(contacts.orgId, orgIds));
  });

  test("counts, samples, and resolves dynamic groups with org isolation", async () => {
    await contactsRepo.create({
      orgId: "org_groups",
      email: "Ada@Example.com",
      customVars: { role: "cto" },
      timezone: "UTC",
    });
    await contactsRepo.create({
      orgId: "org_groups",
      email: "Grace@Test.com",
      customVars: { role: "engineer" },
      timezone: "Africa/Nairobi",
    });
    await contactsRepo.create({ orgId: "org_groups_other", email: "ada@example.com" });

    const group = await groupsRepo.create({
      orgId: "org_groups",
      name: "Example",
      rules: [{ field: "domain", operator: "equals", value: "example.com" }],
      logic: "AND",
      isDynamic: true,
      createdBy: "user_1",
    });

    await expect(groupsRepo.countContacts(group.id, "org_groups")).resolves.toBe(1);
    await expect(groupsRepo.sampleContacts(group.id, "org_groups", 10)).resolves.toHaveLength(1);
    await expect(groupsRepo.resolveContactIds(group.id, "org_groups", 10)).resolves.toHaveLength(1);
  });
});
