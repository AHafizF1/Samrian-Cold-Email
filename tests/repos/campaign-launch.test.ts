import { beforeEach, describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";

import { createDb } from "../../src/server/db/db";
import {
  campaignMailboxes,
  campaigns,
  contactAssignments,
  mailboxes,
} from "../../src/server/db/schema";
import {
  PostgresAssignmentRepo,
  PostgresCampaignMailboxRepo,
  PostgresCampaignRepo,
  PostgresMailboxRepo,
} from "../../src/server/repos";

const testUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testUrl)("postgres campaign launch repos", () => {
  const db = createDb({ driver: "postgres-js", url: testUrl! }).client;
  const campaignsRepo = new PostgresCampaignRepo(db);
  const assignmentsRepo = new PostgresAssignmentRepo(db);
  const mailboxesRepo = new PostgresMailboxRepo(db);
  const campaignMailboxesRepo = new PostgresCampaignMailboxRepo(db);

  beforeEach(async () => {
    await db.delete(contactAssignments).where(eq(contactAssignments.orgId, "org_launch"));
    await db.delete(campaignMailboxes).where(eq(campaignMailboxes.orgId, "org_launch"));
    await db.delete(campaigns).where(eq(campaigns.orgId, "org_launch"));
    await db.delete(mailboxes).where(eq(mailboxes.orgId, "org_launch"));
  });

  test("activates a draft with an expected status guard", async () => {
    const campaign = await campaignsRepo.create({
      orgId: "org_launch",
      name: "Launch",
      schedule: {},
      steps: [{ subject: "Hello", body: "Hi" }],
      status: "draft",
    });

    await expect(campaignsRepo.activateDraft(campaign.id, "org_launch")).resolves.toBe(true);
    await expect(campaignsRepo.getById(campaign.id, "org_launch")).resolves.toMatchObject({
      status: "active",
    });
    await expect(campaignsRepo.activateDraft(campaign.id, "org_launch")).resolves.toBe(false);
  });

  test("replaces campaign mailbox links idempotently and rejects inactive mailboxes", async () => {
    const campaign = await campaignsRepo.create({
      orgId: "org_launch",
      name: "Launch",
      schedule: {},
      steps: [],
    });
    const active = await mailboxesRepo.create({
      orgId: "org_launch",
      name: "Sender",
      provider: "smtp",
      userEmail: "sender@example.com",
      dailySendLimit: 25,
      encryptedPassword: "secret",
    });
    const disconnected = await mailboxesRepo.create({
      orgId: "org_launch",
      name: "Broken",
      provider: "smtp",
      userEmail: "broken@example.com",
      dailySendLimit: 25,
      status: "disconnected",
    });

    await expect(
      campaignMailboxesRepo.replaceForCampaign({
        campaignId: campaign.id,
        orgId: "org_launch",
        mailboxIds: [active.id, active.id],
      })
    ).resolves.toMatchObject({ linked: 1 });
    await expect(
      campaignMailboxesRepo.listForCampaign(campaign.id, "org_launch")
    ).resolves.toHaveLength(1);

    await expect(
      campaignMailboxesRepo.replaceForCampaign({
        campaignId: campaign.id,
        orgId: "org_launch",
        mailboxIds: [disconnected.id],
      })
    ).rejects.toThrow("active mailbox");
  });

  test("creates launch assignments idempotently", async () => {
    const campaign = await campaignsRepo.create({
      orgId: "org_launch",
      name: "Launch",
      schedule: {},
      steps: [],
    });

    await expect(
      assignmentsRepo.createManyForCampaign({
        campaignId: campaign.id,
        orgId: "org_launch",
        contactIds: ["contact_1", "contact_2", "contact_1"],
      })
    ).resolves.toEqual({ created: 2, existing: 0 });
    await expect(
      assignmentsRepo.createManyForCampaign({
        campaignId: campaign.id,
        orgId: "org_launch",
        contactIds: ["contact_1", "contact_2"],
      })
    ).resolves.toEqual({ created: 0, existing: 2 });
    await expect(
      assignmentsRepo.listByCampaign(campaign.id, "org_launch", 10)
    ).resolves.toHaveLength(2);
  });
});
