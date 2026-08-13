import { Worker } from "bullmq";

import type {
  BouncePayload,
  CampaignSendPayload,
  DispatchResult,
  MailboxHealthPayload,
  MailboxPollPayload,
  RampResult,
  SendCampaignResult,
} from "../jobs";
import { JOB_NAMES, type JobName, type QueueConfig } from "../queue";
import { redisConnectionOptions, unwrapJobData } from "../queue/bullmq";
import type { resetCounters } from "../jobs/reset";
import type { pollMailbox } from "../jobs/poll";
import type { processBounce } from "../jobs/bounce";
import type { checkMailboxHealth } from "../jobs/mailbox";
import { withJobTelemetry } from "../observability";

type ResetResult = Awaited<ReturnType<typeof resetCounters>>;
type PollResult = Awaited<ReturnType<typeof pollMailbox>>;
type BounceResult = Awaited<ReturnType<typeof processBounce>>;
type MailboxHealthResult = Awaited<ReturnType<typeof checkMailboxHealth>>;

export type WorkerDeps = {
  sendCampaign(payload: CampaignSendPayload): Promise<SendCampaignResult>;
  pollMailbox(payload: MailboxPollPayload): Promise<PollResult>;
  checkMailboxHealth(payload: MailboxHealthPayload): Promise<MailboxHealthResult>;
  processBounce(payload: BouncePayload): Promise<BounceResult>;
  resetCounters(): Promise<ResetResult>;
  dispatchDueSends(): Promise<DispatchResult>;
  evaluateMailboxRamps(): Promise<RampResult>;
};

export type WorkerProcessorMap = {
  [JOB_NAMES.campaignSend](payload: CampaignSendPayload): Promise<SendCampaignResult>;
  [JOB_NAMES.campaignDispatch](payload: unknown): Promise<DispatchResult>;
  [JOB_NAMES.mailboxPoll](payload: MailboxPollPayload): Promise<PollResult>;
  [JOB_NAMES.mailboxCheck](payload: MailboxHealthPayload): Promise<MailboxHealthResult>;
  [JOB_NAMES.mailboxRamp](payload: unknown): Promise<RampResult>;
  [JOB_NAMES.emailBounce](payload: BouncePayload): Promise<BounceResult>;
  [JOB_NAMES.resetCounters](payload: unknown): Promise<ResetResult>;
};

export type BullMqWorkerRuntime = {
  close(): Promise<void>;
};

export function createBullMqWorkerProcessors(deps: WorkerDeps): WorkerProcessorMap {
  return {
    [JOB_NAMES.campaignSend]: (payload) => deps.sendCampaign(payload),
    [JOB_NAMES.campaignDispatch]: () => deps.dispatchDueSends(),
    [JOB_NAMES.mailboxPoll]: (payload) => deps.pollMailbox(payload),
    [JOB_NAMES.mailboxCheck]: (payload) => deps.checkMailboxHealth(payload),
    [JOB_NAMES.mailboxRamp]: () => deps.evaluateMailboxRamps(),
    [JOB_NAMES.emailBounce]: (payload) => deps.processBounce(payload),
    [JOB_NAMES.resetCounters]: () => deps.resetCounters(),
  };
}

export function createBullMqWorkers(
  config: Extract<QueueConfig, { provider: "bullmq" }>,
  deps: WorkerDeps
) {
  const connection = redisConnectionOptions(config.redisUrl);
  const processors = createBullMqWorkerProcessors(deps);
  const workers = Object.entries(processors).map(
    ([name, processor]) =>
      new Worker(
        name,
        async (job) => {
          const { payload, metadata } = unwrapJobData(job.data as never);
          const run = processor as (payload: unknown) => Promise<unknown>;
          return await withJobTelemetry(
            { jobName: name, payload: metadata ?? (payload as never) },
            () => run(payload)
          );
        },
        {
          connection,
          concurrency: config.concurrency,
          prefix: config.prefix,
        }
      )
  );

  return {
    async close() {
      await Promise.all(workers.map((worker) => worker.close()));
    },
  } satisfies BullMqWorkerRuntime;
}
