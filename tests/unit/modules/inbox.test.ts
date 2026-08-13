import { describe, expect, test, vi } from "vitest";

import { getThread, listInbox, sendReply } from "../../../src/server/modules/inbox";
import type { MailboxConnector, SendOptions, SendResult } from "../../../src/server/jobs/types";
import { FakeRepos } from "../../fakes/fake-repos";

describe("inbox module", () => {
  test("list returns safe display fields without raw email content", async () => {
    const repos = baseRepos();
    Object.assign(repos.threads.data[1]!, {
      from: "PayPal Support <attacker@paypa\u043b.test>",
      textBody: "Interested: https://Example.com/offer",
      htmlBody: "<img src=x onerror=alert(1)>Interested",
      rawHeaders: { Authorization: "secret" },
    });

    const result = await listInbox({ orgId: "org_1", userId: "user_1" }, { repos });

    expect(result.threads[0]).toMatchObject({
      id: "thread_inbound",
      displayText: "Interested: https://Example.com/offer",
      sender: {
        address: "attacker@xn--paypa-4xe.test",
        name: "PayPal Support",
        suspicious: true,
      },
      links: [{ hostname: "example.com", url: "https://example.com/offer" }],
    });
    expect(result.threads[0]).not.toHaveProperty("htmlBody");
    expect(result.threads[0]).not.toHaveProperty("textBody");
    expect(result.threads[0]).not.toHaveProperty("headers");
    expect(result.threads[0]).not.toHaveProperty("rawHeaders");
  });

  test("thread detail returns safe messages without raw email content", async () => {
    const repos = baseRepos();
    Object.assign(repos.threads.data[1]!, {
      htmlBody: "<script>alert(1)</script>Interested",
      rawHeaders: { Authorization: "secret" },
    });

    const result = await getThread(
      { orgId: "org_1", userId: "user_1", threadId: "thread_inbound" },
      { repos }
    );

    expect(result.thread).not.toHaveProperty("htmlBody");
    expect(result.thread).not.toHaveProperty("headers");
    for (const message of result.messages) {
      expect(message).not.toHaveProperty("htmlBody");
      expect(message).not.toHaveProperty("textBody");
      expect(message).not.toHaveProperty("headers");
      expect(message).not.toHaveProperty("rawHeaders");
    }
  });

  test("rejects empty reply body before connector send", async () => {
    const sent = vi.fn();
    const repos = baseRepos();

    await expect(
      sendReply(
        {
          orgId: "org_1",
          userId: "user_1",
          threadId: "thread_inbound",
          body: "  ",
          clientRequestId: "req_1",
        },
        { repos, connectorForMailbox: connector(sent), now: () => 1000 }
      )
    ).rejects.toThrow("Reply body is required");

    expect(sent).not.toHaveBeenCalled();
  });

  test("sends through original mailbox and preserves thread headers", async () => {
    const sent = vi.fn().mockResolvedValue({
      messageId: "manual_reply_1",
      accepted: ["lead@example.com"],
      rejected: [],
    });
    const repos = baseRepos();

    await expect(
      sendReply(
        {
          orgId: "org_1",
          userId: "user_1",
          threadId: "thread_inbound",
          body: "Thanks Ada.",
          clientRequestId: "req_1",
        },
        { repos, connectorForMailbox: connector(sent), now: () => 1000 }
      )
    ).resolves.toMatchObject({
      status: "sent",
      messageId: "manual_reply_1",
    });

    expect(sent).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "lead@example.com",
        subject: "Re: Intro",
        text: "Thanks Ada.",
        inReplyTo: "<reply_1@example.com>",
        references: ["<sent_1@example.com>", "<reply_1@example.com>"],
      })
    );
    expect(
      repos.threads.data.find((thread) => thread.messageId === "manual_reply_1")
    ).toMatchObject({
      direction: "sent",
      classification: "manual-reply",
      textBody: "Thanks Ada.",
    });
    expect(repos.mailboxes.data[0]?.sentToday).toBe(1);
  });

  test("does not insert sent reply when connector fails", async () => {
    const repos = baseRepos();

    await expect(
      sendReply(
        {
          orgId: "org_1",
          userId: "user_1",
          threadId: "thread_inbound",
          body: "Thanks.",
          clientRequestId: "req_1",
        },
        {
          repos,
          connectorForMailbox: connector(vi.fn().mockRejectedValue(new Error("provider down"))),
          now: () => 1000,
        }
      )
    ).rejects.toThrow("provider down");

    expect(repos.threads.data.some((thread) => thread.classification === "manual-reply")).toBe(
      false
    );
    expect(repos.mailboxes.data[0]?.sentToday).toBeUndefined();
  });

  test("keeps manual replies inside total mailbox capacity", async () => {
    const repos = baseRepos();
    repos.mailboxes.data[0]!.dailySendLimit = 10;
    repos.mailboxes.data[0]!.sentToday = 9;
    repos.mailboxes.data[0]!.reservedSends = 1;
    const sent = vi.fn();

    await expect(
      sendReply(
        {
          orgId: "org_1",
          userId: "user_1",
          threadId: "thread_inbound",
          body: "Thanks.",
          clientRequestId: "req_1",
        },
        { repos, connectorForMailbox: connector(sent), now: () => 1000 }
      )
    ).rejects.toThrow("Mailbox daily capacity reached");

    expect(sent).not.toHaveBeenCalled();
  });
});

function baseRepos() {
  return new FakeRepos({
    mailboxes: [{ id: "mailbox_1", orgId: "org_1", email: "sender@example.com", status: "active" }],
    threads: [
      {
        id: "thread_sent",
        orgId: "org_1",
        campaignId: "campaign_1",
        contactId: "contact_1",
        mailboxId: "mailbox_1",
        messageId: "<sent_1@example.com>",
        direction: "sent",
        subject: "Intro",
        sentAt: 100,
      },
      {
        id: "thread_inbound",
        orgId: "org_1",
        campaignId: "campaign_1",
        contactId: "contact_1",
        mailboxId: "mailbox_1",
        messageId: "<reply_1@example.com>",
        inReplyTo: "<sent_1@example.com>",
        references: ["<sent_1@example.com>"],
        providerThreadId: "provider_thread_1",
        direction: "received",
        from: "lead@example.com",
        to: ["sender@example.com"],
        subject: "Re: Intro",
        textBody: "Interested",
        headers: { "Message-ID": "<reply_1@example.com>" },
        receivedAt: 200,
      },
    ],
  });
}

function connector(send: (message: SendOptions) => Promise<SendResult>) {
  return async (): Promise<MailboxConnector> => ({
    send,
    async pollNewMessages() {
      return [];
    },
    async close() {},
  });
}
