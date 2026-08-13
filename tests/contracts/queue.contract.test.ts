import { describe, expect, test } from "vitest";

import type { CampaignSendJob, JobQueue } from "../../src/server/ports";
import { FakeJobQueue } from "../fakes/fake-queue";

describe("JobQueue contract", () => {
  test("enqueues campaign send jobs with payload and options", async () => {
    const queue = new FakeJobQueue();
    const port: JobQueue = queue;
    const payload: CampaignSendJob = {
      assignmentId: "assignment_1",
      campaignId: "campaign_1",
      contactId: "contact_1",
      mailboxId: "mailbox_1",
      orgId: "org_1",
      stepNumber: 0,
    };

    const result = await port.enqueueCampaignSend(payload, {
      delayMs: 1_000,
      attempts: 3,
      idempotencyKey: "campaign_1:contact_1:0",
    });

    expect(result.jobId).toBeTruthy();
    expect(queue.jobs).toEqual([
      {
        id: result.jobId,
        name: "campaign.send",
        payload,
        options: {
          delayMs: 1_000,
          attempts: 3,
          idempotencyKey: "campaign_1:contact_1:0",
        },
      },
    ]);
  });

  test("records scheduled reset without executing it", async () => {
    const queue = new FakeJobQueue();
    const port: JobQueue = queue;

    const result = await port.scheduleDailyCounterReset({
      cron: "0 0 * * *",
      timezone: "UTC",
    });

    expect(result.jobId).toBeTruthy();
    expect(queue.jobs).toHaveLength(1);
    expect(queue.jobs[0]).toMatchObject({
      name: "maintenance.reset-counters",
      options: { cron: "0 0 * * *", timezone: "UTC" },
    });
  });

  test("preserves correlation metadata without changing job payload", async () => {
    const queue = new FakeJobQueue();
    const port: JobQueue = queue;
    const payload: CampaignSendJob = {
      assignmentId: "assignment_1",
      campaignId: "campaign_1",
      contactId: "contact_1",
      mailboxId: "mailbox_1",
      orgId: "org_1",
      stepNumber: 0,
    };

    const result = await port.enqueueCampaignSend(payload, {
      metadata: { correlationId: "corr_1", requestId: "req_1" },
    });

    expect(queue.jobs).toEqual([
      {
        id: result.jobId,
        name: "campaign.send",
        payload,
        options: {
          metadata: { correlationId: "corr_1", requestId: "req_1" },
        },
      },
    ]);
  });
});
