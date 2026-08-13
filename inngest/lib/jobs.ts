import type { JobQueue } from "../../src/server/ports";

type StepLike = {
  sendEvent(name: string, payload: unknown): Promise<unknown>;
};

export function createInngestQueue(step: StepLike): JobQueue {
  return {
    enqueueCampaignSend: async (payload, options) => {
      await step.sendEvent(`enqueue-campaign-send-${payload.assignmentId}-${payload.stepNumber}`, {
        name: "campaign/send",
        data: payload,
      });
      return { jobId: options?.idempotencyKey ?? `${payload.campaignId}:${payload.contactId}` };
    },
    enqueueMailboxPoll: async (payload) => {
      await step.sendEvent(`enqueue-mailbox-poll-${payload.mailboxId}`, {
        name: "mailbox/poll/single",
        data: payload,
      });
      return { jobId: `${payload.mailboxId}:poll` };
    },
    enqueueMailboxCheck: async (payload) => {
      await step.sendEvent(`enqueue-mailbox-check-${payload.mailboxId}`, {
        name: "mailbox/check",
        data: payload,
      });
      return { jobId: `${payload.mailboxId}:check` };
    },
    enqueueBounceProcess: async (payload) => {
      await step.sendEvent(`enqueue-bounce-process-${payload.campaignId}-${payload.contactId}`, {
        name: "email/bounce",
        data: payload,
      });
      return { jobId: payload.messageId };
    },
    scheduleDailyCounterReset: async () => ({ jobId: "inngest-cron-reset-counters" }),
    scheduleCampaignDispatch: async () => ({ jobId: "inngest-cron-campaign-dispatch" }),
    scheduleMailboxChecks: async () => ({ jobId: "inngest-cron-mailbox-checks" }),
    scheduleMailboxRamp: async () => ({ jobId: "inngest-cron-mailbox-ramp" }),
  };
}
