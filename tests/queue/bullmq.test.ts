import { Queue } from "bullmq";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import type { CampaignSendJob } from "../../src/server/ports";
import { BullMqQueue, readQueueConfig } from "../../src/server/queue";
import { redisConnectionOptions } from "../../src/server/queue/bullmq";

const testRedisUrl = process.env.TEST_REDIS_URL;

describe("queue config", () => {
  test("defaults to inngest provider", () => {
    expect(readQueueConfig({})).toMatchObject({ provider: "inngest", concurrency: 5 });
  });

  test("rejects invalid provider and missing Redis URL", () => {
    expect(() => readQueueConfig({ JOB_PROVIDER: "sidekiq" })).toThrow(
      "JOB_PROVIDER must be one of: inngest, bullmq"
    );
    expect(() => readQueueConfig({ JOB_PROVIDER: "bullmq" })).toThrow(
      "REDIS_URL is required when JOB_PROVIDER=bullmq"
    );
  });

  test("reads BullMQ Redis config", () => {
    expect(
      readQueueConfig({
        JOB_PROVIDER: "bullmq",
        REDIS_URL: "redis://localhost:6379",
        WORKER_CONCURRENCY: "8",
      })
    ).toMatchObject({
      provider: "bullmq",
      redisUrl: "redis://localhost:6379",
      concurrency: 8,
    });
  });
});

describe.skipIf(!testRedisUrl)("BullMqQueue", () => {
  const queuePrefix = `samrian-test-${crypto.randomUUID()}`;
  let queue: BullMqQueue;

  beforeEach(async () => {
    queue = new BullMqQueue({ redisUrl: testRedisUrl!, prefix: queuePrefix });
  });

  afterEach(async () => {
    await queue.close();
    await Promise.all(
      [
        "campaign.send",
        "campaign.dispatch",
        "mailbox.poll",
        "email.bounce",
        "maintenance.reset-counters",
      ].map(async (name) => {
        const cleanup = new Queue(name, {
          connection: redisConnectionOptions(testRedisUrl!),
          prefix: queuePrefix,
        });
        await cleanup.obliterate({ force: true });
        await cleanup.close();
      })
    );
  });

  test("enqueues campaign send with delay, attempts, and idempotency key", async () => {
    const payload: CampaignSendJob = {
      assignmentId: "assignment_1",
      campaignId: "campaign_1",
      contactId: "contact_1",
      mailboxId: "mailbox_1",
      orgId: "org_1",
      stepNumber: 1,
    };

    const result = await queue.enqueueCampaignSend(payload, {
      delayMs: 1_000,
      attempts: 3,
      idempotencyKey: "campaign_1:contact_1:1",
    });
    const duplicate = await queue.enqueueCampaignSend(payload, {
      idempotencyKey: "campaign_1:contact_1:1",
    });

    const jobs = await queue.getJobs("campaign.send");
    expect(duplicate.jobId).toBe(result.jobId);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.data).toEqual(payload);
    expect(jobs[0]?.opts).toMatchObject({
      delay: 1_000,
      attempts: 3,
      jobId: "campaign_1:contact_1:1",
    });
  });

  test("enqueues mailbox poll, bounce, and daily reset jobs", async () => {
    await queue.enqueueMailboxPoll({ mailboxId: "mailbox_1", orgId: "org_1" });
    await queue.enqueueBounceProcess({
      messageId: "message_1",
      orgId: "org_1",
      campaignId: "campaign_1",
      contactId: "contact_1",
      dsnCode: "5.1.1",
    });
    await queue.scheduleDailyCounterReset({ cron: "0 0 * * *", timezone: "UTC" });
    await queue.scheduleCampaignDispatch({ cron: "*/5 * * * *", timezone: "UTC" });

    await expect(queue.getJobs("mailbox.poll")).resolves.toHaveLength(1);
    await expect(queue.getJobs("email.bounce")).resolves.toHaveLength(1);
    await expect(queue.getRepeatableJobs("maintenance.reset-counters")).resolves.toHaveLength(1);
    await expect(queue.getRepeatableJobs("campaign.dispatch")).resolves.toHaveLength(1);
  });
});
