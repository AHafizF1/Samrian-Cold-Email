import { describe, expect, test, vi } from "vitest";

import {
  notifyCampaignPaused,
  notifyMailboxDisconnected,
  notifyReply,
  notifySendFailed,
} from "../../../src/server/modules/notifications";
import { FakeNotificationRepo } from "../../fakes/fake-repos";

describe("notification module", () => {
  test("centralizes notification copy and event data", async () => {
    const notifications = new FakeNotificationRepo();

    await notifyReply(notifications, {
      orgId: "org_1",
      threadId: "thread_1",
      campaignId: "campaign_1",
      contactId: "contact_1",
      from: "ada@example.com",
      subject: "Re: Hello",
    });
    await notifyMailboxDisconnected(notifications, {
      orgId: "org_1",
      mailboxId: "mailbox_1",
      email: "sender@example.com",
    });
    await notifyCampaignPaused(notifications, {
      orgId: "org_1",
      campaignId: "campaign_1",
      campaignName: "Launch",
      reason: "bounce_threshold",
    });
    await notifySendFailed(notifications, {
      orgId: "org_1",
      campaignId: "campaign_1",
      contactId: "contact_1",
      mailboxId: "mailbox_1",
      reason: "connector failed",
    });

    expect(notifications.data).toMatchObject([
      { type: "reply", title: "New reply from ada@example.com" },
      { type: "mailbox_disconnected", title: "Mailbox disconnected" },
      { type: "campaign_paused", title: "Campaign paused: Launch" },
      { type: "send_failed", title: "Email send failed" },
    ]);
  });

  test("reply forwarding is optional and non-fatal", async () => {
    const notifications = new FakeNotificationRepo();
    const forward = vi.fn().mockRejectedValue(new Error("forward failed"));

    await expect(
      notifyReply(
        notifications,
        {
          orgId: "org_1",
          threadId: "thread_1",
          from: "ada@example.com",
          subject: "Re: Hello",
        },
        {
          prefs: {
            orgId: "org_1",
            userId: "user_1",
            replyInAppEnabled: true,
            replyForwardEnabled: true,
            replyForwardEmails: ["owner@example.com"],
            browserPushEnabled: false,
          },
          forwarder: { forwardReply: forward },
        }
      )
    ).resolves.toBeUndefined();

    expect(notifications.data).toMatchObject([{ type: "reply" }]);
    expect(forward).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["owner@example.com"],
        subject: "New reply from ada@example.com",
      })
    );
  });
});
