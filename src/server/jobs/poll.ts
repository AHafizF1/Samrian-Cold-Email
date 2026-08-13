import type {
  ConnectorFactory,
  JobRepos,
  JobTransaction,
  MailboxPollPayload,
  PollDispatchDeps,
  RawMessage,
} from "./types";
import { parseBounce } from "../modules/bounces";
import { autoReplyEvent, recordEvent, replyEvent, unsubscribeEvent } from "../modules/events";
import { classifyInbound, normalizeInboundMessage } from "../modules/inbound";
import { notifyReply } from "../modules/notifications";
import { processBounce } from "./bounce";

export async function dispatchMailboxPolls(deps: PollDispatchDeps) {
  const mailboxes = await deps.repos.mailboxes.listActive();

  for (const mailbox of mailboxes) {
    await deps.queue.enqueueMailboxPoll({ mailboxId: mailbox.id, orgId: mailbox.orgId });
  }

  return { status: "dispatched" as const, count: mailboxes.length };
}

export async function pollMailbox(
  payload: MailboxPollPayload,
  deps: {
    repos?: JobRepos;
    connectorForMailbox: ConnectorFactory;
    now(): number;
    transaction?: JobTransaction;
  }
) {
  const run =
    deps.transaction ??
    ((operation) => {
      if (!deps.repos) throw new Error("Mailbox poll repositories are not configured");
      return operation(deps.repos);
    });
  const mailbox = await run((repos) => repos.mailboxes.getById(payload.mailboxId, payload.orgId));
  if (!mailbox) return { status: "missing" as const, resource: "mailbox" as const };

  const connector = await deps.connectorForMailbox(mailbox);
  try {
    const messages = await connector.pollNewMessages();
    let matched = 0;
    let ignored = 0;
    let bounced = 0;
    let unsubscribed = 0;
    let autoReplies = 0;

    for (const message of messages) {
      const outcome = await run((repos) => processMessage(payload, message, repos, deps.now));
      if (outcome.ack) await connector.markMessageProcessed?.(message);
      if (outcome.kind === "reply") matched += 1;
      else if (outcome.kind === "bounce") bounced += 1;
      else if (outcome.kind === "unsubscribe") unsubscribed += 1;
      else if (outcome.kind === "auto-reply") autoReplies += 1;
      else ignored += 1;
    }

    await run((repos) =>
      repos.mailboxes.updateLastPolledAt(payload.mailboxId, payload.orgId, deps.now())
    );

    return withOptionalCounts({
      status: "polled" as const,
      polled: messages.length,
      matched,
      ignored,
      bounced,
      unsubscribed,
      autoReplies,
    });
  } finally {
    await connector.close();
  }
}

async function processMessage(
  payload: MailboxPollPayload,
  rawMessage: RawMessage,
  repos: JobRepos,
  now: () => number
): Promise<{ kind: "reply" | "bounce" | "unsubscribe" | "auto-reply" | "ignored"; ack: boolean }> {
  const normalized = normalizeInboundMessage(rawMessage);
  if (!normalized.ok) return { kind: "ignored", ack: true };
  const message = normalized.message;

  const existing = await repos.threads.getByMessageId(message.messageId, payload.orgId);
  if (existing?.direction === "received") return { kind: "ignored", ack: true };

  const classification = classifyInbound(message);
  if (classification.kind === "ignored") return { kind: "ignored", ack: false };

  const sentThread = await repos.threads.findSentForInbound({
    orgId: payload.orgId,
    messageIds: classification.matchMessageIds,
    providerThreadId: classification.providerThreadId,
  });
  if (!sentThread || sentThread.direction !== "sent") return { kind: "ignored", ack: false };

  const receivedThread = await repos.threads.insert({
    orgId: payload.orgId,
    campaignId: sentThread.campaignId,
    contactId: sentThread.contactId,
    mailboxId: payload.mailboxId,
    messageId: message.messageId,
    providerMessageId: message.providerMessageId,
    inReplyTo: message.inReplyTo,
    references: message.references,
    providerThreadId: message.threadId,
    classification: classification.kind,
    processedAt: now(),
    rawHeaders: message.headers,
    direction: "received",
    from: message.from,
    to: message.to,
    subject: message.subject,
    textBody: message.textBody,
    htmlBody: message.htmlBody,
    headers: message.headers,
    attachments: message.attachments,
    providerUrl: message.providerUrl,
    receivedAt: message.receivedAt,
  });

  if (classification.kind === "reply") {
    await notifyReply(repos.notifications, {
      orgId: payload.orgId,
      threadId: receivedThread.id,
      campaignId: sentThread.campaignId,
      contactId: sentThread.contactId,
      from: message.from,
      subject: message.subject,
    });
    await updateMatchedAssignment(repos, sentThread, payload.orgId, "replied");
    await recordEvent(
      replyEvent({
        orgId: payload.orgId,
        campaignId: sentThread.campaignId,
        contactId: sentThread.contactId,
        mailboxId: payload.mailboxId,
        threadId: receivedThread.id,
        messageId: message.messageId,
        occurredAt: now(),
      }),
      { events: repos.events }
    );
  } else if (classification.kind === "unsubscribe") {
    const contact = sentThread.contactId
      ? await repos.contacts.getById(sentThread.contactId, payload.orgId)
      : null;
    await repos.blocklist.add({
      orgId: payload.orgId,
      email: contact?.email ?? message.from,
      reason: "unsubscribed",
    });
    await updateMatchedAssignment(repos, sentThread, payload.orgId, "unsubscribed");
    await recordEvent(
      unsubscribeEvent({
        orgId: payload.orgId,
        campaignId: sentThread.campaignId,
        contactId: sentThread.contactId,
        threadId: receivedThread.id,
        messageId: message.messageId,
        occurredAt: now(),
      }),
      { events: repos.events }
    );
  } else if (classification.kind === "bounce" && sentThread.campaignId && sentThread.contactId) {
    const parsed = parseBounce(message);
    await processBounce(
      {
        messageId: message.messageId,
        orgId: payload.orgId,
        campaignId: sentThread.campaignId,
        contactId: sentThread.contactId,
        bounceType: parsed.bounceType,
        dsnCode: parsed.dsnCode,
      },
      { repos, bounceRateThreshold: 0.05 }
    );
  } else if (classification.kind === "auto-reply") {
    await recordEvent(
      autoReplyEvent({
        orgId: payload.orgId,
        campaignId: sentThread.campaignId,
        contactId: sentThread.contactId,
        mailboxId: payload.mailboxId,
        threadId: receivedThread.id,
        messageId: message.messageId,
        occurredAt: now(),
      }),
      { events: repos.events }
    );
  }

  return { kind: classification.kind, ack: true };
}

async function updateMatchedAssignment(
  repos: JobRepos,
  sentThread: Awaited<ReturnType<JobRepos["threads"]["getByMessageId"]>>,
  orgId: MailboxPollPayload["orgId"],
  status: string
) {
  if (!sentThread?.campaignId || !sentThread.contactId) return;

  const assignment = await repos.assignments.getByCampaignAndContact(
    sentThread.campaignId,
    sentThread.contactId,
    orgId
  );
  if (assignment && assignment.status !== status) {
    await repos.assignments.updateStatus(assignment.id, orgId, status);
  }
}

function withOptionalCounts(input: {
  status: "polled";
  polled: number;
  matched: number;
  ignored: number;
  bounced: number;
  unsubscribed: number;
  autoReplies: number;
}) {
  return {
    status: input.status,
    polled: input.polled,
    matched: input.matched,
    ignored: input.ignored,
    ...(input.bounced > 0 ? { bounced: input.bounced } : {}),
    ...(input.unsubscribed > 0 ? { unsubscribed: input.unsubscribed } : {}),
    ...(input.autoReplies > 0 ? { autoReplies: input.autoReplies } : {}),
  };
}
