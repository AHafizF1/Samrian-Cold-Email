import type {
  AssignmentRecord,
  AssignmentRepo,
  BlocklistRecord,
  BlocklistRepo,
  CampaignRecord,
  CampaignRepo,
  ContactRecord,
  ContactRepo,
  MailboxRecord,
  MailboxRepo,
  ThreadRecord,
  ThreadRepo,
  CampaignStats,
  CreateNotificationInput,
  CountUnreadNotificationsInput,
  EmailEventInput,
  EventRepo,
  ListNotificationsInput,
  NotificationRecord,
  NotificationRepo,
} from "../../src/server/ports";

type FakeRepoSeed = {
  campaigns?: CampaignRecord[];
  contacts?: ContactRecord[];
  mailboxes?: MailboxRecord[];
  blocklist?: BlocklistRecord[];
  assignments?: AssignmentRecord[];
  threads?: ThreadRecord[];
  campaignStats?: CampaignStats[];
};

export class FakeRepos {
  readonly campaigns: CampaignRepo & { data: CampaignRecord[] };
  readonly contacts: ContactRepo & { data: ContactRecord[] };
  readonly mailboxes: MailboxRepo & { data: MailboxRecord[] };
  readonly blocklist: BlocklistRepo & { data: BlocklistRecord[] };
  readonly assignments: AssignmentRepo & { data: AssignmentRecord[] };
  readonly threads: ThreadRepo & { data: ThreadRecord[] };
  readonly events: EventRepo & { data: EmailEventInput[] };

  constructor(seed: FakeRepoSeed = {}) {
    const campaigns = seed.campaigns ?? [];
    const contacts = seed.contacts ?? [];
    const mailboxes = seed.mailboxes ?? [];
    const blocklist = seed.blocklist ?? [];
    const assignments = seed.assignments ?? [];
    const threads = seed.threads ?? [];
    const campaignStats = seed.campaignStats ?? [];

    this.campaigns = {
      data: campaigns,
      getById: async (id, orgId) =>
        campaigns.find((campaign) => campaign.id === id && campaign.orgId === orgId) ?? null,
      updateStatus: async (id, orgId, status) => {
        const campaign = campaigns.find((item) => item.id === id && item.orgId === orgId);
        if (campaign) campaign.status = status;
      },
      getStats: async (id) => campaignStats.find((stats) => stats.campaignId === id) ?? null,
    };

    this.contacts = {
      data: contacts,
      getById: async (id, orgId) =>
        contacts.find((contact) => contact.id === id && contact.orgId === orgId) ?? null,
      updateBounceStatus: async (id, orgId, status) => {
        const contact = contacts.find((item) => item.id === id && item.orgId === orgId);
        if (contact) contact.bounceStatus = status;
      },
    };

    this.mailboxes = {
      data: mailboxes,
      getById: async (id, orgId) =>
        mailboxes.find((mailbox) => mailbox.id === id && mailbox.orgId === orgId) ?? null,
      listActive: async () => mailboxes.filter((mailbox) => mailbox.status !== "disconnected"),
      incrementSentToday: async (id, orgId) => {
        const mailbox = mailboxes.find((item) => item.id === id && item.orgId === orgId);
        if (mailbox) {
          mailbox.sentToday = (mailbox.sentToday ?? 0) + 1;
          mailbox.reservedSends = Math.max(0, (mailbox.reservedSends ?? 0) - 1);
        }
      },
      releaseReservation: async (id, orgId) => {
        const mailbox = mailboxes.find((item) => item.id === id && item.orgId === orgId);
        if (mailbox) mailbox.reservedSends = Math.max(0, (mailbox.reservedSends ?? 0) - 1);
      },
      updateLastPolledAt: async (id, orgId, at) => {
        const mailbox = mailboxes.find((item) => item.id === id && item.orgId === orgId);
        if (mailbox) mailbox.lastPolledAt = at;
      },
      resetDailyCounters: async () => {
        for (const mailbox of mailboxes) {
          mailbox.sentToday = 0;
        }
        return mailboxes.length;
      },
    };

    this.blocklist = {
      data: blocklist,
      isBlocked: async (email, orgId) =>
        blocklist.some((entry) => entry.email === email && entry.orgId === orgId),
      add: async (input) => {
        if (
          !blocklist.some((entry) => entry.email === input.email && entry.orgId === input.orgId)
        ) {
          blocklist.push(input);
        }
      },
    };

    this.assignments = {
      data: assignments,
      getById: async (id, orgId) =>
        assignments.find((item) => item.id === id && item.orgId === orgId) ?? null,
      getByCampaignAndContact: async (_campaignId, _contactId, orgId) =>
        assignments.find((item) => item.orgId === orgId) ?? null,
      advanceStep: async (input) => {
        const assignment = assignments.find(
          (item) => item.id === input.id && item.orgId === input.orgId
        );

        if (!assignment) {
          return { status: "not-found" };
        }

        if (assignment.currentStep !== input.expectedStep) {
          return { status: "stale", currentStep: assignment.currentStep };
        }

        assignment.currentStep += 1;
        assignment.assignedMailboxId = input.mailboxId;
        assignment.lastEmailSentAt = input.sentAt;
        assignment.status = input.completed ? "completed" : "active";
        assignment.nextSendAt = input.nextSendAt;

        return { status: "advanced", currentStep: assignment.currentStep };
      },
      updateStatus: async (id, orgId, status) => {
        const assignment = assignments.find((item) => item.id === id && item.orgId === orgId);
        if (assignment) assignment.status = status;
      },
      listDueForDispatch: async ({ now, limit }) =>
        assignments
          .filter(
            (item) => item.status === "active" && (!item.nextSendAt || item.nextSendAt <= now)
          )
          .slice(0, limit)
          .map((item) => ({
            assignmentId: item.id,
            campaignId: item.campaignId ?? "campaign_1",
            contactId: item.contactId ?? "contact_1",
            orgId: item.orgId,
            currentStep: item.currentStep,
            status: item.status,
            contactEmail: "contact@example.com",
            campaignStatus: "active",
            campaignSteps: [{}],
          })),
      markEnqueued: async (id, orgId, at) => {
        const assignment = assignments.find((item) => item.id === id && item.orgId === orgId);
        if (assignment) assignment.lastEnqueuedAt = at;
      },
      deferUntil: async (id, orgId, at) => {
        const assignment = assignments.find((item) => item.id === id && item.orgId === orgId);
        if (assignment) assignment.nextSendAt = at;
      },
    };

    this.threads = {
      data: threads,
      getById: async (id, orgId) =>
        threads.find((thread) => thread.id === id && thread.orgId === orgId) ?? null,
      getByMessageId: async (messageId, orgId) =>
        threads.find((thread) => thread.messageId === messageId && thread.orgId === orgId) ?? null,
      findByClientRequestId: async (clientRequestId, orgId) =>
        threads.find(
          (thread) => thread.clientRequestId === clientRequestId && thread.orgId === orgId
        ) ?? null,
      listConversation: async (input) =>
        threads
          .filter(
            (thread) =>
              thread.orgId === input.orgId &&
              (!input.campaignId || thread.campaignId === input.campaignId) &&
              (!input.contactId || thread.contactId === input.contactId) &&
              (!input.mailboxId || thread.mailboxId === input.mailboxId) &&
              (!input.providerThreadId || thread.providerThreadId === input.providerThreadId)
          )
          .sort((a, b) => (a.receivedAt ?? a.sentAt ?? 0) - (b.receivedAt ?? b.sentAt ?? 0))
          .slice(0, input.limit),
      listInbox: async ({ orgId, limit }) =>
        threads
          .filter((thread) => thread.orgId === orgId && thread.direction === "received")
          .sort((a, b) => (b.receivedAt ?? b.sentAt ?? 0) - (a.receivedAt ?? a.sentAt ?? 0))
          .slice(0, limit)
          .map((thread) => ({ ...thread, unread: true })),
      countUnreadInbox: async ({ orgId }) =>
        threads.filter((thread) => thread.orgId === orgId && thread.direction === "received")
          .length,
      markRead: async () => {},
      findSentForInbound: async ({ orgId, messageIds, providerThreadId }) =>
        threads.find(
          (thread) =>
            thread.orgId === orgId &&
            thread.direction === "sent" &&
            ((thread.messageId && messageIds.includes(normalizeMessageId(thread.messageId))) ||
              Boolean(providerThreadId && thread.providerThreadId === providerThreadId))
        ) ?? null,
      insert: async (input) => {
        const existing =
          input.messageId &&
          threads.find((item) => item.messageId === input.messageId && item.orgId === input.orgId);
        if (existing) return existing;

        const thread = { id: `thread_${threads.length + 1}`, ...input };
        threads.push(thread);
        return thread;
      },
    };

    this.events = {
      data: [],
      record: async (input) => {
        if (
          this.events.data.some(
            (event) => event.orgId === input.orgId && event.dedupeKey === input.dedupeKey
          )
        ) {
          return { accepted: false };
        }
        this.events.data.push(input);
        return { accepted: true };
      },
      createTrackedLink: async (input) => input,
    };
  }
}

function normalizeMessageId(value?: string): string {
  return (value ?? "").trim().replace(/^<|>$/g, "").toLowerCase();
}

export class FakeNotificationRepo implements NotificationRepo {
  readonly data: NotificationRecord[] = [];

  async create(input: CreateNotificationInput): Promise<NotificationRecord> {
    const notification: NotificationRecord = {
      id: `notification_${this.data.length + 1}`,
      orgId: input.orgId,
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data,
      createdAt: Date.now(),
    };
    this.data.push(notification);
    return notification;
  }

  async getById(id: string, orgId: string): Promise<NotificationRecord | null> {
    return this.data.find((item) => item.id === id && item.orgId === orgId) ?? null;
  }

  async listLatest(input: ListNotificationsInput): Promise<NotificationRecord[]> {
    return this.data
      .filter(
        (item) => item.orgId === input.orgId && (!input.userId || item.userId === input.userId)
      )
      .slice(0, input.limit);
  }

  async countUnread(input: CountUnreadNotificationsInput): Promise<number> {
    return this.data.filter(
      (item) =>
        item.orgId === input.orgId &&
        !item.readAt &&
        (!input.userId || item.userId === input.userId)
    ).length;
  }

  async markRead(id: string, orgId: string, at = new Date()): Promise<void> {
    const notification = this.data.find((item) => item.id === id && item.orgId === orgId);
    if (notification) notification.readAt = at.getTime();
  }

  async markAllRead(input: CountUnreadNotificationsInput, at = new Date()): Promise<number> {
    let count = 0;
    for (const notification of this.data) {
      if (
        notification.orgId === input.orgId &&
        !notification.readAt &&
        (!input.userId || notification.userId === input.userId)
      ) {
        notification.readAt = at.getTime();
        count += 1;
      }
    }
    return count;
  }
}
