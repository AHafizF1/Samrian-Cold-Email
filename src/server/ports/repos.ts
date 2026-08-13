import type {
  AssignmentId,
  AuditId,
  CampaignId,
  ContactId,
  MailboxId,
  NotificationId,
  OrgId,
  ThreadId,
  UserId,
} from "./ids";
import type { AdvanceStepResult } from "./results";

export type CampaignRecord = {
  id: CampaignId;
  orgId: OrgId;
  name: string;
  steps: readonly unknown[];
  status?: string;
  listUnsubscribeEnabled?: boolean | null;
};

export type ContactRecord = {
  id: ContactId;
  orgId: OrgId;
  email: string;
  domain?: string;
  customVars: Record<string, unknown>;
  timezone?: string;
  bounceStatus?: string;
  verificationStatus?: string;
  verificationCheckedAt?: number;
  verificationReason?: string;
  verificationProvider?: string;
};

export type MailboxRecord = {
  id: MailboxId;
  orgId: OrgId;
  email: string;
  provider?: "smtp" | "puzzle" | "mailpool" | "google" | "microsoft";
  status?: string;
  sentToday?: number;
  reservedSends?: number;
  dailySendLimit?: number;
  lastPolledAt?: number;
  lastConnectionTestAt?: number;
  lastConnectionError?: string;
  lastTokenRefreshAt?: number;
  lastTokenRefreshError?: string;
  providerLimitCode?: string;
  providerLimitResetAt?: number;
  rampEnabled?: boolean;
  rampStatus?: string;
  rampCurrentLimit?: number;
  rampTargetLimit?: number;
  rampStartedAt?: number;
  rampIncrement?: number;
  rampNextCheckAt?: number;
  rampHoldUntil?: number;
  rampReason?: string;
  replyReserve?: number;
  archivedAt?: number;
};

export type AssignmentRecord = {
  id: AssignmentId;
  campaignId?: CampaignId;
  contactId?: ContactId;
  orgId: OrgId;
  currentStep: number;
  status: string;
  assignedMailboxId?: MailboxId;
  lastEmailSentAt?: number;
  nextSendAt?: number;
  lastEnqueuedAt?: number;
};

export type DispatchAssignmentRecord = {
  assignmentId: AssignmentId;
  campaignId: CampaignId;
  contactId: ContactId;
  orgId: OrgId;
  currentStep: number;
  status: string;
  contactEmail: string;
  contactTimezone?: string;
  contactBounceStatus?: string;
  contactVerificationStatus?: string;
  campaignStatus: string;
  campaignSchedule?: unknown;
  campaignSteps: readonly unknown[];
};

export type DispatchMailboxRecord = {
  mailboxId: MailboxId;
  emailsSentToday: number;
  reservedSends?: number;
  dailySendLimit: number;
  providerSafeLimit?: number;
  replyReserve?: number;
  lastUsedAt?: number;
  providerLimitResetAt?: number;
  rampEnabled?: boolean;
  rampCurrentLimit?: number;
};

export type ThreadAttachment = {
  id: string;
  filename: string;
  size: number;
  contentType?: string;
  inline: boolean;
  contentId?: string;
};

export type ThreadRecord = {
  id: ThreadId;
  orgId: OrgId;
  campaignId?: CampaignId;
  contactId?: ContactId;
  mailboxId?: MailboxId;
  messageId?: string;
  providerMessageId?: string;
  clientRequestId?: string;
  inReplyTo?: string;
  references?: string[];
  providerThreadId?: string;
  classification?: string;
  processedAt?: number;
  rawHeaders?: Record<string, string>;
  direction?: "sent" | "received";
  from?: string;
  to?: string[];
  subject: string;
  textBody?: string;
  htmlBody?: string;
  headers?: Record<string, string>;
  attachments?: ThreadAttachment[];
  providerUrl?: string;
  sentAt?: number;
  receivedAt?: number;
};

export type InboxThreadRecord = ThreadRecord & {
  unread: boolean;
  displayText?: string;
  excerpt?: string;
};

export type NotificationRecord = {
  id: NotificationId;
  orgId: OrgId;
  userId?: string;
  type: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  readAt?: number;
  createdAt: number;
};

export type AuditRecord = {
  id: AuditId;
  orgId: OrgId;
  action: string;
  createdAt: number;
};

export type BlocklistRecord = {
  orgId: OrgId;
  email: string;
  reason?: string;
};

export type AdvanceStepInput = {
  id: AssignmentId;
  orgId: OrgId;
  expectedStep: number;
  mailboxId: MailboxId;
  sentAt: number;
  completed?: boolean;
  nextSendAt?: number;
};

export type InsertThreadInput = Omit<ThreadRecord, "id">;

export type CreateNotificationInput = {
  orgId: OrgId;
  userId?: string;
  type: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
};

export type ListNotificationsInput = {
  orgId: OrgId;
  userId?: string;
  limit: number;
};

export type CountUnreadNotificationsInput = {
  orgId: OrgId;
  userId?: string;
};

export type CampaignStats = {
  campaignId: CampaignId;
  total: number;
  bounced: number;
  unsubscribed?: number;
};

export type EmailEventType =
  | "sent"
  | "failed"
  | "reply"
  | "unsubscribe"
  | "bounce_hard"
  | "bounce_soft"
  | "auto_reply"
  | "click"
  | "open";

export type EmailEventInput = {
  orgId: OrgId;
  type: EmailEventType;
  dedupeKey: string;
  occurredAt: number;
  campaignId?: CampaignId;
  contactId?: ContactId;
  mailboxId?: MailboxId;
  assignmentId?: AssignmentId;
  threadId?: ThreadId;
  messageId?: string;
  stepNumber?: number;
  metadata?: Record<string, unknown>;
};

export type EventRecordResult = {
  accepted: boolean;
};

export interface CampaignRepo {
  getById(id: CampaignId, orgId: OrgId): Promise<CampaignRecord | null>;
  updateStatus(id: CampaignId, orgId: OrgId, status: string): Promise<void>;
  getStats(id: CampaignId): Promise<CampaignStats | null>;
}

export interface ContactRepo {
  getById(id: ContactId, orgId: OrgId): Promise<ContactRecord | null>;
  updateBounceStatus(id: ContactId, orgId: OrgId, status: "hard" | "soft"): Promise<void>;
}

export interface MailboxRepo {
  getById(id: MailboxId, orgId: OrgId): Promise<MailboxRecord | null>;
  listActive(): Promise<MailboxRecord[]>;
  incrementSentToday(
    id: MailboxId,
    orgId: OrgId,
    reservation?: { assignmentId: AssignmentId; stepNumber: number }
  ): Promise<void>;
  releaseReservation?(
    id: MailboxId,
    orgId: OrgId,
    reservation?: { assignmentId: AssignmentId; stepNumber: number }
  ): Promise<void>;
  updateLastPolledAt(id: MailboxId, orgId: OrgId, at: number): Promise<void>;
  resetDailyCounters(): Promise<number>;
}

export interface AssignmentRepo {
  getById(id: AssignmentId, orgId: OrgId): Promise<AssignmentRecord | null>;
  getByCampaignAndContact(
    campaignId: CampaignId,
    contactId: ContactId,
    orgId: OrgId
  ): Promise<AssignmentRecord | null>;
  advanceStep(input: AdvanceStepInput): Promise<AdvanceStepResult>;
  updateStatus(id: AssignmentId, orgId: OrgId, status: string): Promise<void>;
  listDueForDispatch(input: { now: number; limit: number }): Promise<DispatchAssignmentRecord[]>;
  markEnqueued(id: AssignmentId, orgId: OrgId, at: number): Promise<void>;
  deferUntil(id: AssignmentId, orgId: OrgId, at: number): Promise<void>;
}

export interface ThreadRepo {
  getById(id: ThreadId, orgId: OrgId): Promise<ThreadRecord | null>;
  getByMessageId(messageId: string, orgId: OrgId): Promise<ThreadRecord | null>;
  findByClientRequestId(clientRequestId: string, orgId: OrgId): Promise<ThreadRecord | null>;
  listConversation(input: {
    orgId: OrgId;
    campaignId?: CampaignId;
    contactId?: ContactId;
    mailboxId?: MailboxId;
    providerThreadId?: string;
    limit: number;
  }): Promise<ThreadRecord[]>;
  listInbox(input: { orgId: OrgId; userId: UserId; limit: number }): Promise<InboxThreadRecord[]>;
  countUnreadInbox(input: { orgId: OrgId; userId: UserId }): Promise<number>;
  markRead(input: { orgId: OrgId; userId: UserId; threadId: ThreadId; at?: number }): Promise<void>;
  findSentForInbound(input: {
    orgId: OrgId;
    messageIds: string[];
    providerThreadId?: string;
  }): Promise<ThreadRecord | null>;
  insert(input: InsertThreadInput): Promise<ThreadRecord>;
}

export interface BlocklistRepo {
  isBlocked(email: string, orgId: OrgId): Promise<boolean>;
  add(input: BlocklistRecord): Promise<void>;
}

export interface NotificationRepo {
  create(input: CreateNotificationInput): Promise<NotificationRecord>;
  getById(id: NotificationId, orgId: OrgId): Promise<NotificationRecord | null>;
  listLatest(input: ListNotificationsInput): Promise<NotificationRecord[]>;
  countUnread(input: CountUnreadNotificationsInput): Promise<number>;
  markRead(id: NotificationId, orgId: OrgId, at?: Date): Promise<void>;
  markAllRead(input: CountUnreadNotificationsInput, at?: Date): Promise<number>;
}

export interface AuditRepo {
  getById(id: AuditId, orgId: OrgId): Promise<AuditRecord | null>;
}

export interface EventRepo {
  record(input: EmailEventInput): Promise<EventRecordResult>;
  createTrackedLink?(input: {
    orgId: OrgId;
    originalUrl: string;
    token: string;
    campaignId?: CampaignId;
    contactId?: ContactId;
    assignmentId?: AssignmentId;
    threadId?: ThreadId;
    messageId?: string;
  }): Promise<unknown>;
}
