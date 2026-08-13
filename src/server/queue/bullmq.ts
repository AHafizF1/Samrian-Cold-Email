import { Queue, type ConnectionOptions, type JobsOptions } from "bullmq";

import type {
  BounceJob,
  CampaignSendJob,
  JobOptions,
  JobQueue,
  MailboxCheckJob,
  MailboxPollJob,
  QueueResult,
  ScheduledJobOptions,
} from "../ports";
import type { JobName } from "./names";
import { JOB_NAMES } from "./names";

export type BullMqQueueConfig = {
  redisUrl: string;
  defaultAttempts?: number;
  prefix?: string;
};

export class BullMqQueue implements JobQueue {
  private readonly connection: ConnectionOptions;
  private readonly queues: Record<JobName, Queue>;
  private readonly defaultAttempts: number;

  constructor(config: BullMqQueueConfig) {
    this.connection = redisConnectionOptions(config.redisUrl);
    this.defaultAttempts = config.defaultAttempts ?? 3;
    this.queues = {
      [JOB_NAMES.campaignSend]: this.createQueue(JOB_NAMES.campaignSend, config.prefix),
      [JOB_NAMES.campaignDispatch]: this.createQueue(JOB_NAMES.campaignDispatch, config.prefix),
      [JOB_NAMES.mailboxPoll]: this.createQueue(JOB_NAMES.mailboxPoll, config.prefix),
      [JOB_NAMES.mailboxCheck]: this.createQueue(JOB_NAMES.mailboxCheck, config.prefix),
      [JOB_NAMES.mailboxRamp]: this.createQueue(JOB_NAMES.mailboxRamp, config.prefix),
      [JOB_NAMES.emailBounce]: this.createQueue(JOB_NAMES.emailBounce, config.prefix),
      [JOB_NAMES.resetCounters]: this.createQueue(JOB_NAMES.resetCounters, config.prefix),
    };
  }

  async enqueueCampaignSend(payload: CampaignSendJob, options?: JobOptions): Promise<QueueResult> {
    return this.addJob(JOB_NAMES.campaignSend, payload, options);
  }

  async enqueueMailboxPoll(payload: MailboxPollJob, options?: JobOptions): Promise<QueueResult> {
    return this.addJob(JOB_NAMES.mailboxPoll, payload, options);
  }

  async enqueueMailboxCheck(payload: MailboxCheckJob, options?: JobOptions): Promise<QueueResult> {
    return this.addJob(JOB_NAMES.mailboxCheck, payload, options);
  }

  async enqueueBounceProcess(payload: BounceJob, options?: JobOptions): Promise<QueueResult> {
    return this.addJob(JOB_NAMES.emailBounce, payload, options);
  }

  async scheduleDailyCounterReset(options: ScheduledJobOptions): Promise<QueueResult> {
    const job = await this.queues[JOB_NAMES.resetCounters].add(
      JOB_NAMES.resetCounters,
      {},
      {
        jobId: JOB_NAMES.resetCounters,
        repeat: {
          pattern: options.cron,
          tz: options.timezone,
        },
      }
    );
    return { jobId: job.id ?? JOB_NAMES.resetCounters };
  }

  async scheduleCampaignDispatch(options: ScheduledJobOptions): Promise<QueueResult> {
    const job = await this.queues[JOB_NAMES.campaignDispatch].add(
      JOB_NAMES.campaignDispatch,
      {},
      {
        jobId: JOB_NAMES.campaignDispatch,
        repeat: {
          pattern: options.cron,
          tz: options.timezone,
        },
      }
    );
    return { jobId: job.id ?? JOB_NAMES.campaignDispatch };
  }

  async scheduleMailboxChecks(options: ScheduledJobOptions): Promise<QueueResult> {
    const job = await this.queues[JOB_NAMES.mailboxCheck].add(
      JOB_NAMES.mailboxCheck,
      {},
      {
        jobId: JOB_NAMES.mailboxCheck,
        repeat: {
          pattern: options.cron,
          tz: options.timezone,
        },
      }
    );
    return { jobId: job.id ?? JOB_NAMES.mailboxCheck };
  }

  async scheduleMailboxRamp(options: ScheduledJobOptions): Promise<QueueResult> {
    const job = await this.queues[JOB_NAMES.mailboxRamp].add(
      JOB_NAMES.mailboxRamp,
      {},
      {
        jobId: JOB_NAMES.mailboxRamp,
        repeat: { pattern: options.cron, tz: options.timezone },
      }
    );
    return { jobId: job.id ?? JOB_NAMES.mailboxRamp };
  }

  async getJobs(name: JobName) {
    return this.queues[name].getJobs(["waiting", "delayed", "paused"]);
  }

  async getRepeatableJobs(name: JobName) {
    return this.queues[name].getRepeatableJobs();
  }

  async close(): Promise<void> {
    await Promise.all(Object.values(this.queues).map((queue) => queue.close()));
  }

  private createQueue(name: JobName, prefix: string | undefined) {
    return new Queue(name, { connection: this.connection, prefix });
  }

  private async addJob<T>(name: JobName, payload: T, options?: JobOptions): Promise<QueueResult> {
    const job = await this.queues[name].add(
      name,
      toJobData(payload, options),
      this.toBullMqOptions(options)
    );
    return { jobId: job.id ?? options?.idempotencyKey ?? `${name}:${Date.now()}` };
  }

  private toBullMqOptions(options: JobOptions | undefined): JobsOptions {
    return {
      attempts: options?.attempts ?? this.defaultAttempts,
      delay: options?.delayMs,
      jobId: options?.idempotencyKey,
      removeOnComplete: 100,
      removeOnFail: 500,
    };
  }
}

export type BullMqJobEnvelope<T> = {
  payload: T;
  metadata?: JobOptions["metadata"];
};

export function toJobData<T>(payload: T, options?: JobOptions): T | BullMqJobEnvelope<T> {
  return options?.metadata ? { payload, metadata: options.metadata } : payload;
}

export function unwrapJobData<T>(data: T | BullMqJobEnvelope<T>) {
  if (isEnvelope(data)) return data;
  return { payload: data, metadata: undefined };
}

function isEnvelope<T>(data: T | BullMqJobEnvelope<T>): data is BullMqJobEnvelope<T> {
  return !!data && typeof data === "object" && "payload" in data && "metadata" in data;
}

export function redisConnectionOptions(redisUrl: string): ConnectionOptions {
  const parsed = new URL(redisUrl);
  return {
    host: parsed.hostname,
    port: parsed.port ? Number.parseInt(parsed.port, 10) : 6379,
    username: decodeURIComponent(parsed.username || ""),
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    db: parsed.pathname.length > 1 ? Number.parseInt(parsed.pathname.slice(1), 10) : 0,
    maxRetriesPerRequest: null,
  };
}
