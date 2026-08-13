import { describe, expect, test } from "vitest";

import type {
  AssignmentRepo,
  BlocklistRepo,
  CampaignRepo,
  ContactRepo,
  MailboxRepo,
} from "../../src/server/ports";
import { FakeRepos } from "../fakes/fake-repos";

describe("repository contracts", () => {
  test("campaign, contact, and mailbox lookups are org-scoped", async () => {
    const repos = new FakeRepos({
      campaigns: [{ id: "campaign_1", orgId: "org_1", name: "Launch", steps: [] }],
      contacts: [{ id: "contact_1", orgId: "org_1", email: "ada@example.com", customVars: {} }],
      mailboxes: [{ id: "mailbox_1", orgId: "org_1", email: "sender@example.com" }],
    });

    const campaigns: CampaignRepo = repos.campaigns;
    const contacts: ContactRepo = repos.contacts;
    const mailboxes: MailboxRepo = repos.mailboxes;

    await expect(campaigns.getById("campaign_1", "org_1")).resolves.toMatchObject({
      id: "campaign_1",
    });
    await expect(campaigns.getById("campaign_1", "org_2")).resolves.toBeNull();
    await expect(contacts.getById("contact_1", "org_2")).resolves.toBeNull();
    await expect(mailboxes.getById("mailbox_1", "org_2")).resolves.toBeNull();
  });

  test("blocklist lookup answers whether an email is blocked for an org", async () => {
    const repos = new FakeRepos({
      blocklist: [{ orgId: "org_1", email: "blocked@example.com", reason: "manual" }],
    });
    const blocklist: BlocklistRepo = repos.blocklist;

    await expect(blocklist.isBlocked("blocked@example.com", "org_1")).resolves.toBe(true);
    await expect(blocklist.isBlocked("blocked@example.com", "org_2")).resolves.toBe(false);
  });

  test("assignment advance returns advanced, stale, or not-found", async () => {
    const repos = new FakeRepos({
      assignments: [{ id: "assignment_1", orgId: "org_1", currentStep: 0, status: "active" }],
    });
    const assignments: AssignmentRepo = repos.assignments;

    await expect(
      assignments.advanceStep({
        id: "assignment_1",
        orgId: "org_1",
        expectedStep: 0,
        mailboxId: "mailbox_1",
        sentAt: 123,
      })
    ).resolves.toEqual({ status: "advanced", currentStep: 1 });

    await expect(
      assignments.advanceStep({
        id: "assignment_1",
        orgId: "org_1",
        expectedStep: 0,
        mailboxId: "mailbox_1",
        sentAt: 124,
      })
    ).resolves.toEqual({ status: "stale", currentStep: 1 });

    await expect(
      assignments.advanceStep({
        id: "missing",
        orgId: "org_1",
        expectedStep: 0,
        mailboxId: "mailbox_1",
        sentAt: 125,
      })
    ).resolves.toEqual({ status: "not-found" });
  });
});
