import { describe, expect, test } from "vitest";

import { dispatchMailboxPolls, pollMailbox } from "../../../src/server/jobs/poll";
import type { RawMessage } from "../../../src/server/jobs/types";
import { FakeJobQueue } from "../../fakes/fake-queue";
import { FakeRepos } from "../../fakes/fake-repos";

describe("poll jobs", () => {
  test("dispatches one poll job per active mailbox", async () => {
    const repos = new FakeRepos({
      mailboxes: [
        { id: "mailbox_1", orgId: "org_1", email: "one@example.com", status: "active" },
        { id: "mailbox_2", orgId: "org_1", email: "two@example.com", status: "disconnected" },
      ],
    });
    const queue = new FakeJobQueue();

    await expect(dispatchMailboxPolls({ repos, queue })).resolves.toEqual({
      status: "dispatched",
      count: 1,
    });

    expect(queue.jobs).toMatchObject([
      { name: "mailbox.poll", payload: { mailboxId: "mailbox_1", orgId: "org_1" } },
    ]);
  });

  test("matches replies, ignores unknown messages, and updates last polled time", async () => {
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
          subject: "Hi",
        },
      ],
      assignments: [{ id: "assignment_1", orgId: "org_1", currentStep: 1, status: "active" }],
    });

    await expect(
      pollMailbox(
        { mailboxId: "mailbox_1", orgId: "org_1" },
        {
          repos,
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
                  subject: "Re: Hi",
                  textBody: "Reply",
                  headers: {},
                  receivedAt: 123,
                },
                {
                  messageId: "unknown_1",
                  inReplyTo: "missing",
                  from: "nobody@example.com",
                  to: ["sender@example.com"],
                  subject: "Unknown",
                  headers: {},
                  receivedAt: 124,
                },
              ];
            },
            async close() {},
          }),
          now: () => 200,
        }
      )
    ).resolves.toEqual({ status: "polled", polled: 2, matched: 1, ignored: 1 });

    expect(repos.threads.data.find((thread) => thread.messageId === "reply_1")).toMatchObject({
      direction: "received",
      subject: "Re: Hi",
    });
    expect(repos.assignments.data[0].status).toBe("replied");
    expect(repos.mailboxes.data[0].lastPolledAt).toBe(200);
  });

  test("matches replies by References when In-Reply-To is missing", async () => {
    const repos = basePollRepos();
    const acked: string[] = [];

    await expect(
      pollMailbox(
        { mailboxId: "mailbox_1", orgId: "org_1" },
        deps(repos, acked, [
          {
            messageId: "reply_ref",
            from: "ada@example.com",
            to: ["sender@example.com"],
            subject: "Re: Hi",
            textBody: "Reply",
            headers: {},
            references: ["missing", "sent_1"],
            receivedAt: 123,
          },
        ])
      )
    ).resolves.toMatchObject({ matched: 1, ignored: 0 });

    expect(repos.assignments.data[0].status).toBe("replied");
    expect(acked).toEqual(["reply_ref"]);
  });

  test("matches replies by provider thread id when headers are missing", async () => {
    const repos = basePollRepos();
    repos.threads.data[0].providerThreadId = "provider_thread_1";

    await expect(
      pollMailbox(
        { mailboxId: "mailbox_1", orgId: "org_1" },
        deps(
          repos,
          [],
          [
            {
              messageId: "reply_thread",
              threadId: "provider_thread_1",
              from: "ada@example.com",
              to: ["sender@example.com"],
              subject: "Re: Hi",
              textBody: "Reply",
              headers: {},
              receivedAt: 123,
            },
          ]
        )
      )
    ).resolves.toMatchObject({ matched: 1, ignored: 0 });

    expect(repos.assignments.data[0].status).toBe("replied");
  });

  test("does not duplicate side effects for duplicate inbound message", async () => {
    const repos = basePollRepos();
    repos.threads.data.push({
      id: "thread_existing",
      orgId: "org_1",
      messageId: "reply_1",
      direction: "received",
      campaignId: "campaign_1",
      contactId: "contact_1",
      mailboxId: "mailbox_1",
      subject: "Re: Hi",
    });
    const acked: string[] = [];

    await expect(
      pollMailbox(
        { mailboxId: "mailbox_1", orgId: "org_1" },
        deps(repos, acked, [
          {
            messageId: "reply_1",
            inReplyTo: "sent_1",
            from: "ada@example.com",
            to: ["sender@example.com"],
            subject: "Re: Hi",
            headers: {},
            receivedAt: 123,
          },
        ])
      )
    ).resolves.toMatchObject({ matched: 0, ignored: 1 });

    expect(repos.assignments.data[0].status).toBe("active");
    expect(acked).toEqual(["reply_1"]);
  });

  test("classifies DSN as hard bounce and suppresses contact", async () => {
    const repos = basePollRepos();
    repos.contacts.data.push({
      id: "contact_1",
      orgId: "org_1",
      email: "bad@example.com",
      customVars: {},
    });
    repos.campaigns.data.push({ id: "campaign_1", orgId: "org_1", name: "Campaign", steps: [] });
    repos.campaigns.getStats = async () => ({
      campaignId: "campaign_1",
      total: 20,
      bounced: 0,
      unsubscribed: 0,
    });

    await expect(
      pollMailbox(
        { mailboxId: "mailbox_1", orgId: "org_1" },
        deps(
          repos,
          [],
          [
            {
              messageId: "dsn_1",
              inReplyTo: "sent_1",
              from: "mailer-daemon@example.com",
              to: ["sender@example.com"],
              subject: "Delivery Status Notification",
              textBody: "Status: 5.1.1\nFinal-Recipient: rfc822; bad@example.com",
              headers: { "Content-Type": "multipart/report; report-type=delivery-status" },
              receivedAt: 123,
            },
          ]
        )
      )
    ).resolves.toMatchObject({ bounced: 1, matched: 0 });

    expect(repos.contacts.data[0].bounceStatus).toBe("hard");
    expect(repos.assignments.data[0].status).toBe("bounced");
    expect(repos.blocklist.data).toMatchObject([
      { email: "bad@example.com", reason: "bounced_hard" },
    ]);
  });

  test("soft bounce does not add blocklist entry", async () => {
    const repos = basePollRepos();
    repos.contacts.data.push({
      id: "contact_1",
      orgId: "org_1",
      email: "soft@example.com",
      customVars: {},
    });

    await pollMailbox(
      { mailboxId: "mailbox_1", orgId: "org_1" },
      deps(
        repos,
        [],
        [
          {
            messageId: "dsn_soft",
            inReplyTo: "sent_1",
            from: "mailer-daemon@example.com",
            to: ["sender@example.com"],
            subject: "Delivery Status Notification",
            textBody: "Status: 4.2.2\nFinal-Recipient: rfc822; soft@example.com",
            headers: { "Content-Type": "multipart/report; report-type=delivery-status" },
            receivedAt: 123,
          },
        ]
      )
    );

    expect(repos.contacts.data[0].bounceStatus).toBe("soft");
    expect(repos.blocklist.data).toEqual([]);
  });

  test("auto-reply is stored but does not stop follow-up", async () => {
    const repos = basePollRepos();

    await expect(
      pollMailbox(
        { mailboxId: "mailbox_1", orgId: "org_1" },
        deps(
          repos,
          [],
          [
            {
              messageId: "ooo_1",
              inReplyTo: "sent_1",
              from: "ada@example.com",
              to: ["sender@example.com"],
              subject: "Out of office",
              textBody: "I am out of office this week.",
              headers: { "Auto-Submitted": "auto-replied" },
              receivedAt: 123,
            },
          ]
        )
      )
    ).resolves.toMatchObject({ autoReplies: 1, matched: 0 });

    expect(repos.assignments.data[0].status).toBe("active");
    expect(repos.threads.data.find((thread) => thread.messageId === "ooo_1")).toMatchObject({
      classification: "auto-reply",
    });
  });

  test("unsubscribe reply adds blocklist and marks assignment unsubscribed", async () => {
    const repos = basePollRepos();
    repos.contacts.data.push({
      id: "contact_1",
      orgId: "org_1",
      email: "ada@example.com",
      customVars: {},
    });

    await expect(
      pollMailbox(
        { mailboxId: "mailbox_1", orgId: "org_1" },
        deps(
          repos,
          [],
          [
            {
              messageId: "unsub_1",
              inReplyTo: "sent_1",
              from: "ada@example.com",
              to: ["sender@example.com"],
              subject: "Re: Hi",
              textBody: "Please stop emailing me.",
              headers: {},
              receivedAt: 123,
            },
          ]
        )
      )
    ).resolves.toMatchObject({ unsubscribed: 1, matched: 0 });

    expect(repos.assignments.data[0].status).toBe("unsubscribed");
    expect(repos.blocklist.data).toMatchObject([
      { email: "ada@example.com", reason: "unsubscribed" },
    ]);
  });

  test("does not ack message when processing fails before side effects finish", async () => {
    const repos = basePollRepos();
    repos.threads.insert = async () => {
      throw new Error("db down");
    };
    const acked: string[] = [];

    await expect(
      pollMailbox(
        { mailboxId: "mailbox_1", orgId: "org_1" },
        deps(repos, acked, [
          {
            messageId: "reply_fail",
            inReplyTo: "sent_1",
            from: "ada@example.com",
            to: ["sender@example.com"],
            subject: "Re: Hi",
            headers: {},
            receivedAt: 123,
          },
        ])
      )
    ).rejects.toThrow("db down");

    expect(acked).toEqual([]);
  });

  test("acks and ignores rejected oversized inbound messages without storing them", async () => {
    const repos = basePollRepos();
    const acked: string[] = [];

    await expect(
      pollMailbox(
        { mailboxId: "mailbox_1", orgId: "org_1" },
        deps(repos, acked, [
          {
            messageId: "oversized_1",
            inReplyTo: "sent_1",
            from: "ada@example.com",
            to: ["sender@example.com"],
            subject: "Re: Hi",
            textBody: "x".repeat(256 * 1024 + 1),
            headers: {},
            receivedAt: 123,
          },
        ])
      )
    ).resolves.toMatchObject({ matched: 0, ignored: 1 });

    expect(acked).toEqual(["oversized_1"]);
    expect(repos.threads.data.some((thread) => thread.messageId === "oversized_1")).toBe(false);
  });

  test("stores normalized envelope text for valid inbound messages", async () => {
    const repos = basePollRepos();

    await pollMailbox(
      { mailboxId: "mailbox_1", orgId: "org_1" },
      deps(
        repos,
        [],
        [
          {
            messageId: "reply_controls",
            inReplyTo: "sent_1",
            from: "Ada\u202E <ada@example.com>",
            to: ["sender@example.com"],
            subject: "Re:\0 Hi",
            textBody: "Reply",
            headers: {},
            receivedAt: 123,
          },
        ]
      )
    );

    expect(
      repos.threads.data.find((thread) => thread.messageId === "reply_controls")
    ).toMatchObject({
      from: "Ada <ada@example.com>",
      subject: "Re: Hi",
    });
  });
});

function basePollRepos() {
  return new FakeRepos({
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
        subject: "Hi",
      },
    ],
    assignments: [
      {
        id: "assignment_1",
        orgId: "org_1",
        campaignId: "campaign_1",
        contactId: "contact_1",
        currentStep: 1,
        status: "active",
      },
    ],
  });
}

function deps(repos: FakeRepos, acked: string[], messages: RawMessage[]) {
  return {
    repos,
    connectorForMailbox: async () => ({
      async send() {
        throw new Error("unused");
      },
      async pollNewMessages() {
        return messages;
      },
      async markMessageProcessed(message: { messageId: string }) {
        acked.push(message.messageId);
      },
      async close() {},
    }),
    now: () => 200,
  };
}
