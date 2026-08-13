import { beforeEach, describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";

import { createDb } from "../../src/server/db/db";
import {
  campaignStatsDaily,
  emailEvents,
  mailboxStatsDaily,
  orgStatsDaily,
  trackedLinks,
} from "../../src/server/db/schema";
import { PostgresEventRepo, PostgresStatsRepo } from "../../src/server/repos";

const testUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testUrl)("postgres event repo", () => {
  const db = createDb({ driver: "postgres-js", url: testUrl! }).client;
  const events = new PostgresEventRepo(db);
  const stats = new PostgresStatsRepo(db);

  beforeEach(async () => {
    await db.delete(emailEvents).where(eq(emailEvents.orgId, "org_events"));
    await db.delete(orgStatsDaily).where(eq(orgStatsDaily.orgId, "org_events"));
    await db.delete(campaignStatsDaily).where(eq(campaignStatsDaily.orgId, "org_events"));
    await db.delete(mailboxStatsDaily).where(eq(mailboxStatsDaily.orgId, "org_events"));
    await db.delete(trackedLinks).where(eq(trackedLinks.orgId, "org_events"));
  });

  test("records event once and increments rollups once", async () => {
    const input = {
      orgId: "org_events",
      campaignId: "campaign_1",
      mailboxId: "mailbox_1",
      type: "sent" as const,
      dedupeKey: "sent:assignment_1:0",
      occurredAt: Date.UTC(2026, 0, 1),
    };

    await expect(events.record(input)).resolves.toEqual({ accepted: true });
    await expect(events.record(input)).resolves.toEqual({ accepted: false });

    await expect(stats.getOrgStats("org_events")).resolves.toMatchObject({ sent: 1 });
    await expect(
      stats.getCampaignStats({ orgId: "org_events", campaignId: "campaign_1" })
    ).resolves.toMatchObject({ sent: 1 });
  });

  test("tracks total and unique clicks separately", async () => {
    await events.record({
      orgId: "org_events",
      type: "click",
      dedupeKey: "click:link_1:unique",
      occurredAt: Date.UTC(2026, 0, 1),
      metadata: { unique: true },
    });
    await events.record({
      orgId: "org_events",
      type: "click",
      dedupeKey: "click:link_1:repeat_1",
      occurredAt: Date.UTC(2026, 0, 1),
      metadata: { unique: false },
    });

    await expect(stats.getOrgStats("org_events")).resolves.toMatchObject({
      totalClicks: 2,
      uniqueClicks: 1,
    });
  });

  test("stores tracked links by server token", async () => {
    await events.createTrackedLink({
      orgId: "org_events",
      token: "token_1",
      originalUrl: "https://example.com/demo",
      campaignId: "campaign_1",
    });

    await expect(events.getTrackedLink("token_1")).resolves.toMatchObject({
      originalUrl: "https://example.com/demo",
      campaignId: "campaign_1",
    });
  });
});
