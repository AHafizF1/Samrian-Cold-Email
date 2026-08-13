import { beforeEach, describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";

import { createDb } from "../../src/server/db/db";
import { notifications } from "../../src/server/db/schema";
import { PostgresNotificationRepo } from "../../src/server/repos";

const testUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testUrl)("postgres notification repo", () => {
  const db = createDb({ driver: "postgres-js", url: testUrl! }).client;
  const repo = new PostgresNotificationRepo(db);

  beforeEach(async () => {
    await db.delete(notifications).where(eq(notifications.orgId, "org_repo"));
    await db.delete(notifications).where(eq(notifications.orgId, "org_other"));
  });

  test("creates, lists latest, counts unread, and marks read per org", async () => {
    const first = await repo.create({
      orgId: "org_repo",
      userId: "user_1",
      type: "reply",
      title: "New reply",
      body: "Ada replied",
      data: { threadId: "thread_1" },
    });
    const second = await repo.create({
      orgId: "org_repo",
      userId: "user_1",
      type: "campaign_paused",
      title: "Campaign paused",
    });
    await repo.create({ orgId: "org_other", type: "reply", title: "Other org" });

    await expect(repo.listLatest({ orgId: "org_repo", limit: 10 })).resolves.toMatchObject([
      { id: second.id, type: "campaign_paused" },
      { id: first.id, type: "reply", body: "Ada replied", data: { threadId: "thread_1" } },
    ]);
    await expect(repo.countUnread({ orgId: "org_repo" })).resolves.toBe(2);

    await repo.markRead(first.id, "org_repo", new Date("2026-01-01T00:00:00Z"));
    await expect(repo.countUnread({ orgId: "org_repo", userId: "user_1" })).resolves.toBe(1);

    await repo.markAllRead({ orgId: "org_repo", userId: "user_1" }, new Date());
    await expect(repo.countUnread({ orgId: "org_repo" })).resolves.toBe(0);
    await expect(repo.getById(first.id, "org_other")).resolves.toBeNull();
  });
});
