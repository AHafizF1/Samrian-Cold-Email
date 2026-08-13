import { describe, expect, test, vi } from "vitest";

import {
  createBullMqWorkerProcessors,
  scheduleWorkerJobs,
  type WorkerDeps,
  type WorkerProcessorMap,
} from "../../src/server/worker";
import type { JobQueue } from "../../src/server/ports";

describe("BullMQ worker processors", () => {
  test("route jobs to shared handlers", async () => {
    const calls: string[] = [];
    const deps = createDeps(calls);
    const processors = createBullMqWorkerProcessors(deps);

    await processors["campaign.send"]({
      assignmentId: "assignment_1",
      campaignId: "campaign_1",
      contactId: "contact_1",
      mailboxId: "mailbox_1",
      orgId: "org_1",
      stepNumber: 0,
    });
    await processors["mailbox.poll"]({ mailboxId: "mailbox_1", orgId: "org_1" });
    await processors["mailbox.check"]({ mailboxId: "mailbox_1", orgId: "org_1" });
    await processors["email.bounce"]({
      messageId: "message_1",
      orgId: "org_1",
      campaignId: "campaign_1",
      contactId: "contact_1",
    });
    await processors["maintenance.reset-counters"](undefined);
    await processors["campaign.dispatch"](undefined);
    await processors["mailbox.ramp"](undefined);

    expect(calls).toEqual(["send", "poll", "check", "bounce", "reset", "dispatch", "ramp"]);
  });

  test("preserves handler failures for BullMQ retries", async () => {
    const processors: WorkerProcessorMap = createBullMqWorkerProcessors({
      ...createDeps([]),
      sendCampaign: vi.fn(async () => {
        throw new Error("connector failed");
      }),
    });

    await expect(
      processors["campaign.send"]({
        assignmentId: "assignment_1",
        campaignId: "campaign_1",
        contactId: "contact_1",
        mailboxId: "mailbox_1",
        orgId: "org_1",
        stepNumber: 0,
      })
    ).rejects.toThrow("connector failed");
  });

  test("registers recurring worker schedules", async () => {
    const queue = {
      scheduleCampaignDispatch: vi.fn(async () => ({ jobId: "dispatch" })),
      scheduleMailboxChecks: vi.fn(async () => ({ jobId: "checks" })),
      scheduleMailboxRamp: vi.fn(async () => ({ jobId: "ramp" })),
      scheduleDailyCounterReset: vi.fn(async () => ({ jobId: "reset" })),
    } as unknown as JobQueue;

    await scheduleWorkerJobs(queue);

    expect(queue.scheduleCampaignDispatch).toHaveBeenCalledWith({
      cron: "*/5 * * * *",
      timezone: "UTC",
    });
    expect(queue.scheduleMailboxRamp).toHaveBeenCalledWith({
      cron: "15 0 * * *",
      timezone: "UTC",
    });
  });
});

function createDeps(calls: string[]): WorkerDeps {
  return {
    sendCampaign: vi.fn(async () => {
      calls.push("send");
      return { status: "sent", messageId: "message_1" } as const;
    }),
    pollMailbox: vi.fn(async () => {
      calls.push("poll");
      return { status: "polled", polled: 1, matched: 1, ignored: 0 } as const;
    }),
    checkMailboxHealth: vi.fn(async () => {
      calls.push("check");
      return { status: "healthy", mailboxId: "mailbox_1" } as const;
    }),
    processBounce: vi.fn(async () => {
      calls.push("bounce");
      return {
        status: "processed",
        messageId: "message_1",
        email: "ada@example.com",
        bounceType: "hard",
        campaignPaused: false,
      } as const;
    }),
    resetCounters: vi.fn(async () => {
      calls.push("reset");
      return { status: "reset", count: 1 } as const;
    }),
    dispatchDueSends: vi.fn(async () => {
      calls.push("dispatch");
      return {
        enqueued: 1,
        deferred: 0,
        skipped: 0,
        missingCapacity: 0,
        stale: 0,
        limit: 100,
      } as const;
    }),
    evaluateMailboxRamps: vi.fn(async () => {
      calls.push("ramp");
      return {
        advanced: 1,
        held: 0,
        reduced: 0,
        paused: 0,
        recovering: 0,
        unchanged: 0,
        failed: 0,
        limit: 100,
      };
    }),
  };
}
