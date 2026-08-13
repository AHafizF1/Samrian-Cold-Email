import type { AssignmentId, CampaignId, ContactId, JobId, MailboxId, OrgId } from "./ids";

export type CampaignSendJob = {
  assignmentId: AssignmentId;
  campaignId: CampaignId;
  contactId: ContactId;
  mailboxId: MailboxId;
  orgId: OrgId;
  stepNumber: number;
};

export type MailboxPollJob = {
  mailboxId: MailboxId;
  orgId: OrgId;
};

export type MailboxCheckJob = {
  mailboxId: MailboxId;
  orgId: OrgId;
};

export type BounceJob = {
  messageId: string;
  orgId: OrgId;
  campaignId: CampaignId;
  contactId: ContactId;
  bounceType?: "hard" | "soft";
  dsnCode?: string;
};

export type CampaignDispatchJob = undefined;

export type JobOptions = {
  delayMs?: number;
  attempts?: number;
  idempotencyKey?: string;
  metadata?: {
    requestId?: string;
    correlationId?: string;
  };
};

export type ScheduledJobOptions = {
  cron: string;
  timezone: string;
};

export type QueueResult = {
  jobId: JobId;
};

export interface JobQueue {
  enqueueCampaignSend(payload: CampaignSendJob, options?: JobOptions): Promise<QueueResult>;
  enqueueMailboxPoll(payload: MailboxPollJob, options?: JobOptions): Promise<QueueResult>;
  enqueueMailboxCheck(payload: MailboxCheckJob, options?: JobOptions): Promise<QueueResult>;
  enqueueBounceProcess(payload: BounceJob, options?: JobOptions): Promise<QueueResult>;
  scheduleDailyCounterReset(options: ScheduledJobOptions): Promise<QueueResult>;
  scheduleCampaignDispatch(options: ScheduledJobOptions): Promise<QueueResult>;
  scheduleMailboxChecks(options: ScheduledJobOptions): Promise<QueueResult>;
  scheduleMailboxRamp(options: ScheduledJobOptions): Promise<QueueResult>;
}
