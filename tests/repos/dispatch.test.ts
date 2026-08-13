import { beforeEach, describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";

import { createDb } from "../../src/server/db/db";
import {
  campaignMailboxes,
  campaigns,
  contactAssignments,
  contacts,
  mailboxes,
} from "../../src/server/db/schema";
import {
  PostgresAssignmentRepo,
  PostgresCampaignMailboxRepo,
  PostgresCampaignRepo,
  PostgresContactRepo,
  PostgresMailboxRepo,
} from "../../src/server/repos";

const testUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testUrl)("postgres dispatch repos", () => {
  const db = createDb({ driver: "postgres-js", url: testUrl! }).client;
  const campaignsRepo = new PostgresCampaignRepo(db);
  const contactsRepo = new PostgresContactRepo(db);
  const assignmentsRepo = new PostgresAssignmentRepo(db);
  const mailboxesRepo = new PostgresMailboxRepo(db);
  const campaignMailboxesRepo = new PostgresCampaignMailboxRepo(db);

  beforeEach(async () => {
    await db.delete(contactAssignments).where(eq(contactAssignments.orgId, "org_dispatch"));
    await db.delete(campaignMailboxes).where(eq(campaignMailboxes.orgId, "org_dispatch"));
    await db.delete(campaigns).where(eq(campaigns.orgId, "org_dispatch"));
    await db.delete(contacts).where(eq(contacts.orgId, "org_dispatch"));
    await db.delete(mailboxes).where(eq(mailboxes.orgId, "org_dispatch"));
  });

  test("lists due active assignments with campaign and contact dispatch shape", async () => {
    const campaign = await campaignsRepo.create({
      orgId: "org_dispatch",
      name: "Dispatch",
      status: "active",
      schedule: { timezone: "UTC", startTime: "09:00", endTime: "17:00" },
      steps: [{ subject: "Hi", body: "Hello" }],
    });
    const contact = await contactsRepo.create({
      orgId: "org_dispatch",
      email: "ada@example.com",
      timezone: "UTC",
    });
    await assignmentsRepo.create({
      campaignId: campaign.id,
      contactId: contact.id,
      orgId: "org_dispatch",
      nextSendAt: 1_000,
    });

    await expect(
      assignmentsRepo.listDueForDispatch({ now: 2_000, limit: 10 })
    ).resolves.toMatchObject([
      {
        campaignId: campaign.id,
        contactId: contact.id,
        orgId: "org_dispatch",
        contactEmail: "ada@example.com",
        currentStep: 0,
      },
    ]);
  });

  test("persists enqueue and defer state", async () => {
    const campaign = await campaignsRepo.create({
      orgId: "org_dispatch",
      name: "Dispatch",
      status: "active",
      schedule: {},
      steps: [{}],
    });
    const contact = await contactsRepo.create({ orgId: "org_dispatch", email: "ada@example.com" });
    const assignment = await assignmentsRepo.create({
      campaignId: campaign.id,
      contactId: contact.id,
      orgId: "org_dispatch",
    });

    await assignmentsRepo.markEnqueued(assignment.id, "org_dispatch", 5_000);
    await assignmentsRepo.deferUntil(assignment.id, "org_dispatch", 9_000);

    await expect(assignmentsRepo.getById(assignment.id, "org_dispatch")).resolves.toMatchObject({
      lastEnqueuedAt: 5_000,
      nextSendAt: 9_000,
    });
  });

  test("lists active linked mailboxes sorted by capacity policy", async () => {
    const campaign = await campaignsRepo.create({
      orgId: "org_dispatch",
      name: "Dispatch",
      status: "active",
      schedule: {},
      steps: [{}],
    });
    const highUse = await mailboxesRepo.create({
      orgId: "org_dispatch",
      name: "High",
      provider: "smtp",
      userEmail: "high@example.com",
      dailySendLimit: 25,
      encryptedPassword: "secret",
    });
    const lowUse = await mailboxesRepo.create({
      orgId: "org_dispatch",
      name: "Low",
      provider: "smtp",
      userEmail: "low@example.com",
      dailySendLimit: 25,
      encryptedPassword: "secret",
    });
    await campaignMailboxesRepo.replaceForCampaign({
      campaignId: campaign.id,
      orgId: "org_dispatch",
      mailboxIds: [highUse.id, lowUse.id],
    });
    for (let index = 0; index < 2; index += 1) {
      await mailboxesRepo.incrementSentToday(highUse.id, "org_dispatch");
    }

    await expect(
      campaignMailboxesRepo.listDispatchMailboxes(campaign.id, "org_dispatch")
    ).resolves.toMatchObject([{ mailboxId: lowUse.id }, { mailboxId: highUse.id }]);
  });
});
