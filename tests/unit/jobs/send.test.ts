import { describe, expect, test } from "vitest";

import { sendCampaign } from "../../../src/server/jobs/send";
import { FakeRepos } from "../../fakes/fake-repos";
import type { MailboxConnector } from "../../../src/server/jobs/types";

function makeConnector(): MailboxConnector & { sent: unknown[] } {
  return {
    sent: [],
    async send(message) {
      this.sent.push(message);
      return { messageId: "message_1", accepted: [message.to], rejected: [] };
    },
    async pollNewMessages() {
      return [];
    },
    async close() {},
  };
}

describe("sendCampaign", () => {
  test("keeps provider send outside tenant transaction", async () => {
    const repos = new FakeRepos({
      campaigns: [
        {
          id: "campaign_1",
          orgId: "org_1",
          name: "Launch",
          steps: [{ subject: "Hi", body: "Hello" }],
        },
      ],
      contacts: [{ id: "contact_1", orgId: "org_1", email: "ada@example.com", customVars: {} }],
      mailboxes: [{ id: "mailbox_1", orgId: "org_1", email: "sender@example.com" }],
      assignments: [{ id: "assignment_1", orgId: "org_1", currentStep: 0, status: "active" }],
    });
    let inTransaction = false;
    const connector = makeConnector();
    connector.send = async (message) => {
      expect(inTransaction).toBe(false);
      return { messageId: "message_1", accepted: [message.to], rejected: [] };
    };

    await sendCampaign(
      {
        assignmentId: "assignment_1",
        campaignId: "campaign_1",
        contactId: "contact_1",
        mailboxId: "mailbox_1",
        orgId: "org_1",
        stepNumber: 0,
      },
      {
        transaction: async (operation) => {
          inTransaction = true;
          try {
            return await operation(repos);
          } finally {
            inTransaction = false;
          }
        },
        connectorForMailbox: async () => connector,
        generateUnsubscribeToken: async () => "token",
        appUrl: "https://app.example.com",
        now: () => 123,
      }
    );
  });

  test("sends email, advances assignment, inserts thread, and increments counter", async () => {
    const repos = new FakeRepos({
      campaigns: [
        {
          id: "campaign_1",
          orgId: "org_1",
          name: "Launch",
          steps: [{ subject: "Hi {{firstName}}", body: "<p>Hello {{firstName}}</p>" }],
        },
      ],
      contacts: [
        {
          id: "contact_1",
          orgId: "org_1",
          email: "ada@example.com",
          customVars: { firstName: "Ada" },
        },
      ],
      mailboxes: [{ id: "mailbox_1", orgId: "org_1", email: "sender@example.com" }],
      assignments: [{ id: "assignment_1", orgId: "org_1", currentStep: 0, status: "active" }],
    });
    const connector = makeConnector();

    await expect(
      sendCampaign(
        {
          assignmentId: "assignment_1",
          campaignId: "campaign_1",
          contactId: "contact_1",
          mailboxId: "mailbox_1",
          orgId: "org_1",
          stepNumber: 0,
        },
        {
          repos,
          connectorForMailbox: async () => connector,
          generateUnsubscribeToken: async () => "token",
          appUrl: "https://app.example.com",
          now: () => 123,
        }
      )
    ).resolves.toEqual({ status: "sent", messageId: "message_1" });

    expect(repos.assignments.data[0].currentStep).toBe(1);
    expect(repos.mailboxes.data[0].sentToday).toBe(1);
    expect(repos.threads.data).toHaveLength(1);
    expect(repos.threads.data[0]).toMatchObject({
      messageId: "message_1",
      subject: "Hi Ada",
      textBody: "Hello Ada",
    });
    expect(repos.events.data).toContainEqual(
      expect.objectContaining({
        type: "sent",
        dedupeKey: "sent:assignment_1:0",
      })
    );
  });

  test("returns stale before sending when event step is not current", async () => {
    const repos = new FakeRepos({
      campaigns: [{ id: "campaign_1", orgId: "org_1", name: "Launch", steps: [] }],
      contacts: [{ id: "contact_1", orgId: "org_1", email: "ada@example.com", customVars: {} }],
      mailboxes: [{ id: "mailbox_1", orgId: "org_1", email: "sender@example.com" }],
      assignments: [{ id: "assignment_1", orgId: "org_1", currentStep: 1, status: "active" }],
    });
    const connector = makeConnector();

    await expect(
      sendCampaign(
        {
          assignmentId: "assignment_1",
          campaignId: "campaign_1",
          contactId: "contact_1",
          mailboxId: "mailbox_1",
          orgId: "org_1",
          stepNumber: 0,
        },
        {
          repos,
          connectorForMailbox: async () => connector,
          generateUnsubscribeToken: async () => "token",
          appUrl: "https://app.example.com",
          now: () => 123,
        }
      )
    ).resolves.toEqual({ status: "stale", currentStep: 1 });

    expect(connector.sent).toHaveLength(0);
    expect(repos.threads.data).toHaveLength(0);
  });

  test("skips blocked contacts", async () => {
    const repos = new FakeRepos({
      campaigns: [{ id: "campaign_1", orgId: "org_1", name: "Launch", steps: [] }],
      contacts: [{ id: "contact_1", orgId: "org_1", email: "blocked@example.com", customVars: {} }],
      mailboxes: [{ id: "mailbox_1", orgId: "org_1", email: "sender@example.com" }],
      assignments: [{ id: "assignment_1", orgId: "org_1", currentStep: 0, status: "active" }],
      blocklist: [{ orgId: "org_1", email: "blocked@example.com", reason: "manual" }],
    });
    const connector = makeConnector();

    await expect(
      sendCampaign(
        {
          assignmentId: "assignment_1",
          campaignId: "campaign_1",
          contactId: "contact_1",
          mailboxId: "mailbox_1",
          orgId: "org_1",
          stepNumber: 0,
        },
        {
          repos,
          connectorForMailbox: async () => connector,
          generateUnsubscribeToken: async () => "token",
          appUrl: "https://app.example.com",
          now: () => 123,
        }
      )
    ).resolves.toEqual({ status: "skipped", reason: "blocked" });

    expect(connector.sent).toHaveLength(0);
  });

  test("skips before connector send when mailbox daily cap is reached", async () => {
    const repos = new FakeRepos({
      campaigns: [
        {
          id: "campaign_1",
          orgId: "org_1",
          name: "Launch",
          steps: [{ subject: "Hi", body: "Hello" }],
        },
      ],
      contacts: [{ id: "contact_1", orgId: "org_1", email: "ada@example.com", customVars: {} }],
      mailboxes: [
        {
          id: "mailbox_1",
          orgId: "org_1",
          email: "sender@example.com",
          sentToday: 25,
          dailySendLimit: 25,
        },
      ],
      assignments: [{ id: "assignment_1", orgId: "org_1", currentStep: 0, status: "active" }],
    });
    const connector = makeConnector();

    await expect(
      sendCampaign(
        {
          assignmentId: "assignment_1",
          campaignId: "campaign_1",
          contactId: "contact_1",
          mailboxId: "mailbox_1",
          orgId: "org_1",
          stepNumber: 0,
        },
        {
          repos,
          connectorForMailbox: async () => connector,
          generateUnsubscribeToken: async () => "token",
          appUrl: "https://app.example.com",
          now: () => 123,
        }
      )
    ).resolves.toEqual({ status: "skipped", reason: "mailbox-limit" });

    expect(connector.sent).toHaveLength(0);
  });

  test("marks final step completed after successful send", async () => {
    const repos = new FakeRepos({
      campaigns: [
        {
          id: "campaign_1",
          orgId: "org_1",
          name: "Launch",
          steps: [{ subject: "Hi", body: "Hello" }],
        },
      ],
      contacts: [{ id: "contact_1", orgId: "org_1", email: "ada@example.com", customVars: {} }],
      mailboxes: [{ id: "mailbox_1", orgId: "org_1", email: "sender@example.com" }],
      assignments: [{ id: "assignment_1", orgId: "org_1", currentStep: 0, status: "active" }],
    });

    await sendCampaign(
      {
        assignmentId: "assignment_1",
        campaignId: "campaign_1",
        contactId: "contact_1",
        mailboxId: "mailbox_1",
        orgId: "org_1",
        stepNumber: 0,
      },
      {
        repos,
        connectorForMailbox: async () => makeConnector(),
        generateUnsubscribeToken: async () => "token",
        appUrl: "https://app.example.com",
        now: () => 123,
      }
    );

    expect(repos.assignments.data[0]).toMatchObject({
      currentStep: 1,
      status: "completed",
      nextSendAt: undefined,
    });
  });

  test("sets nextSendAt for follow-up step delay", async () => {
    const repos = new FakeRepos({
      campaigns: [
        {
          id: "campaign_1",
          orgId: "org_1",
          name: "Launch",
          steps: [
            { subject: "Hi", body: "Hello" },
            { subject: "Follow up", body: "Checking in", delayDays: 2 },
          ],
        },
      ],
      contacts: [{ id: "contact_1", orgId: "org_1", email: "ada@example.com", customVars: {} }],
      mailboxes: [{ id: "mailbox_1", orgId: "org_1", email: "sender@example.com" }],
      assignments: [{ id: "assignment_1", orgId: "org_1", currentStep: 0, status: "active" }],
    });

    await sendCampaign(
      {
        assignmentId: "assignment_1",
        campaignId: "campaign_1",
        contactId: "contact_1",
        mailboxId: "mailbox_1",
        orgId: "org_1",
        stepNumber: 0,
      },
      {
        repos,
        connectorForMailbox: async () => makeConnector(),
        generateUnsubscribeToken: async () => "token",
        appUrl: "https://app.example.com",
        now: () => 1000,
      }
    );

    expect(repos.assignments.data[0]).toMatchObject({
      currentStep: 1,
      status: "active",
      nextSendAt: 1000 + 2 * 24 * 60 * 60 * 1000,
    });
  });
});
