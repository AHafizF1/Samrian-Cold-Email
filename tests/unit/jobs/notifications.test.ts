import { describe, expect, test } from "vitest";

import { processBounce } from "../../../src/server/jobs/bounce";
import { pollMailbox } from "../../../src/server/jobs/poll";
import { sendCampaign } from "../../../src/server/jobs/send";
import { FakeNotificationRepo, FakeRepos } from "../../fakes/fake-repos";

describe("job notification writes", () => {
  test("poll creates a reply notification", async () => {
    const repos = new FakeRepos({
      mailboxes: [{ id: "mailbox_1", orgId: "org_1", email: "sender@example.com" }],
      threads: [
        {
          id: "thread_1",
          orgId: "org_1",
          messageId: "sent_1",
          direction: "sent",
          campaignId: "campaign_1",
          contactId: "contact_1",
          mailboxId: "mailbox_1",
          subject: "Hello",
        },
      ],
      assignments: [{ id: "assignment_1", orgId: "org_1", currentStep: 1, status: "active" }],
    });
    const notifications = new FakeNotificationRepo();

    await pollMailbox(
      { mailboxId: "mailbox_1", orgId: "org_1" },
      {
        repos: { ...repos, notifications },
        connectorForMailbox: async () => ({
          async send() {
            throw new Error("unused");
          },
          async pollNewMessages() {
            return [
              {
                messageId: "reply_1",
                inReplyTo: "sent_1",
                from: "ada@example.com",
                to: ["sender@example.com"],
                subject: "Re: Hello",
                headers: {},
                receivedAt: 123,
              },
            ];
          },
          async close() {},
        }),
        now: () => 200,
      }
    );

    expect(notifications.data).toMatchObject([{ type: "reply", orgId: "org_1" }]);
  });

  test("bounce auto-pause creates a campaign notification", async () => {
    const repos = new FakeRepos({
      campaigns: [{ id: "campaign_1", orgId: "org_1", name: "Launch", steps: [] }],
      contacts: [{ id: "contact_1", orgId: "org_1", email: "ada@example.com", customVars: {} }],
      assignments: [{ id: "assignment_1", orgId: "org_1", currentStep: 0, status: "active" }],
      campaignStats: [{ campaignId: "campaign_1", total: 10, bounced: 1 }],
    });
    const notifications = new FakeNotificationRepo();

    await processBounce(
      {
        messageId: "bounce_1",
        orgId: "org_1",
        campaignId: "campaign_1",
        contactId: "contact_1",
        bounceType: "hard",
      },
      { repos: { ...repos, notifications }, bounceRateThreshold: 0.05 }
    );

    expect(notifications.data).toMatchObject([{ type: "campaign_paused" }]);
  });

  test("send connector failure creates send failure notification", async () => {
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
    const notifications = new FakeNotificationRepo();

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
          repos: { ...repos, notifications },
          connectorForMailbox: async () => ({
            async send() {
              throw new Error("connector failed");
            },
            async pollNewMessages() {
              return [];
            },
            async close() {},
          }),
          generateUnsubscribeToken: async () => "token",
          appUrl: "http://localhost:3000",
          now: () => 100,
        }
      )
    ).rejects.toThrow("connector failed");

    expect(notifications.data).toMatchObject([{ type: "send_failed" }]);
  });
});
