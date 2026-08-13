import type {
  AssignmentId,
  CampaignId,
  ContactId,
  MailboxId,
  OrgId,
  ThreadAttachment,
} from "../ports";
import type {
  AssignmentRepo,
  BlocklistRepo,
  CampaignRepo,
  ContactRepo,
  EventRepo,
  JobQueue,
  MailboxRecord,
  MailboxRepo,
  NotificationRepo,
  ThreadRepo,
} from "../ports";

export type SendOptions = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
  inReplyTo?: string;
  references?: string[];
  providerThreadId?: string;
};

export type SendResult = {
  messageId: string;
  accepted: string[];
  rejected: string[];
};

export type RawMessage = {
  messageId: string;
  providerMessageId?: string;
  threadId?: string;
  from: string;
  to: string[];
  subject: string;
  textBody?: string;
  htmlBody?: string;
  headers: Record<string, string>;
  inReplyTo?: string;
  references?: string[];
  snippet?: string;
  mimeType?: string;
  partMimeTypes?: string[];
  attachments?: AttachmentRef[];
  providerUrl?: string;
  receivedAt: number;
};

export type AttachmentRef = ThreadAttachment;

export type AttachmentDownload = {
  body: ReadableStream<Uint8Array>;
  size: number;
};

export type MailboxConnector = {
  send(message: SendOptions): Promise<SendResult>;
  pollNewMessages(): Promise<RawMessage[]>;
  markMessageProcessed?(message: RawMessage): Promise<void>;
  getAttachment?(
    providerMessageId: string,
    attachmentId: string
  ): Promise<AttachmentDownload | null>;
  getFreshAccessToken?(): Promise<string>;
  testConnection?(): Promise<{ ok: boolean; error?: string; requiresReconnect?: boolean }>;
  close(): Promise<void>;
};

export type JobRepos = {
  campaigns: CampaignRepo;
  contacts: ContactRepo;
  mailboxes: MailboxRepo;
  assignments: AssignmentRepo;
  blocklist: BlocklistRepo;
  threads: ThreadRepo;
  notifications?: NotificationRepo;
  events?: EventRepo;
};

export type JobTransaction = <T>(operation: (repos: JobRepos) => Promise<T>) => Promise<T>;

export type ConnectorFactory = (mailbox: MailboxRecord) => Promise<MailboxConnector>;

export type CampaignSendPayload = {
  assignmentId: AssignmentId;
  campaignId: CampaignId;
  contactId: ContactId;
  mailboxId: MailboxId;
  orgId: OrgId;
  stepNumber: number;
};

export type MailboxPollPayload = {
  mailboxId: MailboxId;
  orgId: OrgId;
};

export type BouncePayload = {
  messageId: string;
  orgId: OrgId;
  campaignId: CampaignId;
  contactId: ContactId;
  bounceType?: "hard" | "soft";
  dsnCode?: string;
};

export type PollDispatchDeps = {
  repos: Pick<JobRepos, "mailboxes">;
  queue: JobQueue;
};
