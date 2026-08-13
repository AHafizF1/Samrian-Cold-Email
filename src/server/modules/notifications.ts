import type { NotificationRepo, OrgId } from "../ports";
import { logger } from "../observability/runtime";
import { shouldForwardReply, type NotificationPrefs } from "./notification-prefs";

type NotifyDeps = NotificationRepo | undefined;

export type NotificationForwarder = {
  forwardReply(input: {
    orgId: OrgId;
    to: string[];
    subject: string;
    body: string;
    threadId: string;
  }): Promise<void>;
};

export async function notifyReply(
  repo: NotifyDeps,
  input: {
    orgId: OrgId;
    threadId: string;
    campaignId?: string;
    contactId?: string;
    from: string;
    subject: string;
  },
  options?: { prefs?: NotificationPrefs; forwarder?: NotificationForwarder }
) {
  const title = `New reply from ${input.from}`;
  if (options?.prefs?.replyInAppEnabled ?? true) {
    await safeNotify(repo, {
      orgId: input.orgId,
      type: "reply",
      title,
      body: input.subject,
      data: {
        threadId: input.threadId,
        campaignId: input.campaignId,
        contactId: input.contactId,
      },
    });
  }

  if (options?.prefs && options.forwarder && shouldForwardReply(options.prefs)) {
    await safeForward(options.forwarder, {
      orgId: input.orgId,
      to: options.prefs.replyForwardEmails,
      subject: title,
      body: input.subject,
      threadId: input.threadId,
    });
  }
}

export async function notifyMailboxDisconnected(
  repo: NotifyDeps,
  input: { orgId: OrgId; mailboxId: string; email: string }
) {
  await safeNotify(repo, {
    orgId: input.orgId,
    type: "mailbox_disconnected",
    title: "Mailbox disconnected",
    body: input.email,
    data: { mailboxId: input.mailboxId },
  });
}

export async function notifyCampaignPaused(
  repo: NotifyDeps,
  input: { orgId: OrgId; campaignId: string; campaignName?: string; reason: string }
) {
  await safeNotify(repo, {
    orgId: input.orgId,
    type: "campaign_paused",
    title: `Campaign paused: ${input.campaignName ?? input.campaignId}`,
    body: input.reason,
    data: { campaignId: input.campaignId, reason: input.reason },
  });
}

export async function notifySendFailed(
  repo: NotifyDeps,
  input: {
    orgId: OrgId;
    campaignId: string;
    contactId: string;
    mailboxId: string;
    reason: string;
  }
) {
  await safeNotify(repo, {
    orgId: input.orgId,
    type: "send_failed",
    title: "Email send failed",
    body: input.reason,
    data: {
      campaignId: input.campaignId,
      contactId: input.contactId,
      mailboxId: input.mailboxId,
    },
  });
}

export async function notifyMailboxRamp(
  repo: NotifyDeps,
  input: {
    orgId: OrgId;
    mailboxId: string;
    email: string;
    status: "paused" | "reduced" | "recovering";
    reason: string;
    currentLimit: number;
  }
) {
  await safeNotify(repo, {
    orgId: input.orgId,
    type: "mailbox_ramp",
    title: `Mailbox ramp ${input.status}`,
    body: `${input.email}: ${input.reason}`,
    data: {
      mailboxId: input.mailboxId,
      status: input.status,
      reason: input.reason,
      currentLimit: input.currentLimit,
    },
  });
}

export async function notifyImportDone(
  repo: NotifyDeps,
  input: { orgId: OrgId; imported: number; failed: number }
) {
  await safeNotify(repo, {
    orgId: input.orgId,
    type: "import_done",
    title: "Import complete",
    body: `${input.imported} imported, ${input.failed} failed`,
    data: { imported: input.imported, failed: input.failed },
  });
}

async function safeNotify(
  repo: NotifyDeps,
  input: Parameters<NonNullable<NotifyDeps>["create"]>[0]
) {
  if (!repo) return;
  try {
    await repo.create(input);
  } catch (error) {
    logger.warn("notification.write_failed", { orgId: input.orgId, error });
  }
}

async function safeForward(
  forwarder: NotificationForwarder,
  input: Parameters<NotificationForwarder["forwardReply"]>[0]
) {
  try {
    await forwarder.forwardReply(input);
  } catch (error) {
    logger.warn("notification.forward_failed", { orgId: input.orgId, error });
  }
}
