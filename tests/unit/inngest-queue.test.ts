import { describe, expect, test, vi } from "vitest";

import { createInngestQueue } from "../../inngest/lib/jobs";

describe("Inngest queue adapter", () => {
  test("uses a unique durable step id for each campaign send", async () => {
    const stepIds: string[] = [];
    const sendEvent = vi.fn(async (stepId: string, _payload: unknown) => {
      stepIds.push(stepId);
      return {};
    });
    const queue = createInngestQueue({ sendEvent });

    await queue.enqueueCampaignSend({
      assignmentId: "assignment_1",
      campaignId: "campaign_1",
      contactId: "contact_1",
      mailboxId: "mailbox_1",
      orgId: "org_1",
      stepNumber: 0,
    });
    await queue.enqueueCampaignSend({
      assignmentId: "assignment_2",
      campaignId: "campaign_1",
      contactId: "contact_2",
      mailboxId: "mailbox_1",
      orgId: "org_1",
      stepNumber: 0,
    });

    expect(stepIds).toEqual([
      "enqueue-campaign-send-assignment_1-0",
      "enqueue-campaign-send-assignment_2-0",
    ]);
  });
});
