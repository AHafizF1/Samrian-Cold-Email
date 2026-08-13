import type {
  BounceJob,
  CampaignSendJob,
  JobOptions,
  JobQueue,
  MailboxCheckJob,
  MailboxPollJob,
  QueueResult,
  ScheduledJobOptions,
} from "../../src/server/ports";

type FakeJob =
  | {
      id: string;
      name: "campaign.send";
      payload: CampaignSendJob;
      options?: JobOptions;
    }
  | {
      id: string;
      name: "maintenance.reset-counters";
      options: ScheduledJobOptions;
    }
  | {
      id: string;
      name: "campaign.dispatch";
      options: ScheduledJobOptions;
    }
  | {
      id: string;
      name: "mailbox.poll";
      payload: MailboxPollJob;
      options?: JobOptions;
    }
  | {
      id: string;
      name: "mailbox.check";
      payload?: MailboxCheckJob;
      options?: JobOptions | ScheduledJobOptions;
    }
  | {
      id: string;
      name: "mailbox.ramp";
      options: ScheduledJobOptions;
    }
  | {
      id: string;
      name: "email.bounce";
      payload: BounceJob;
      options?: JobOptions;
    };

export class FakeJobQueue implements JobQueue {
  readonly jobs: FakeJob[] = [];

  async enqueueCampaignSend(payload: CampaignSendJob, options?: JobOptions): Promise<QueueResult> {
    const id = this.nextId();
    this.jobs.push({ id, name: "campaign.send", payload, options });
    return { jobId: id };
  }

  async scheduleDailyCounterReset(options: ScheduledJobOptions): Promise<QueueResult> {
    const id = this.nextId();
    this.jobs.push({ id, name: "maintenance.reset-counters", options });
    return { jobId: id };
  }

  async scheduleCampaignDispatch(options: ScheduledJobOptions): Promise<QueueResult> {
    const id = this.nextId();
    this.jobs.push({ id, name: "campaign.dispatch", options });
    return { jobId: id };
  }

  async enqueueMailboxPoll(payload: MailboxPollJob, options?: JobOptions): Promise<QueueResult> {
    const id = this.nextId();
    this.jobs.push({ id, name: "mailbox.poll", payload, options });
    return { jobId: id };
  }

  async enqueueMailboxCheck(payload: MailboxCheckJob, options?: JobOptions): Promise<QueueResult> {
    const id = this.nextId();
    this.jobs.push({ id, name: "mailbox.check", payload, options });
    return { jobId: id };
  }

  async scheduleMailboxChecks(options: ScheduledJobOptions): Promise<QueueResult> {
    const id = this.nextId();
    this.jobs.push({ id, name: "mailbox.check", options });
    return { jobId: id };
  }

  async scheduleMailboxRamp(options: ScheduledJobOptions): Promise<QueueResult> {
    const id = this.nextId();
    this.jobs.push({ id, name: "mailbox.ramp", options });
    return { jobId: id };
  }

  async enqueueBounceProcess(payload: BounceJob, options?: JobOptions): Promise<QueueResult> {
    const id = this.nextId();
    this.jobs.push({ id, name: "email.bounce", payload, options });
    return { jobId: id };
  }

  private nextId() {
    return `fake-job-${this.jobs.length + 1}`;
  }
}
