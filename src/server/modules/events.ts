import type { EmailEventInput, EventRepo, EventRecordResult } from "../ports";

export async function recordEvent(
  input: EmailEventInput,
  deps: { events?: EventRepo }
): Promise<EventRecordResult> {
  if (!deps.events) return { accepted: false };
  return deps.events.record(input);
}

export function sentEvent(input: {
  orgId: string;
  campaignId: string;
  contactId: string;
  mailboxId: string;
  assignmentId: string;
  messageId: string;
  stepNumber: number;
  occurredAt: number;
}): EmailEventInput {
  return {
    ...input,
    type: "sent",
    dedupeKey: `sent:${input.assignmentId}:${input.stepNumber}`,
  };
}

export function failedEvent(input: {
  orgId: string;
  campaignId: string;
  contactId: string;
  mailboxId: string;
  assignmentId: string;
  stepNumber: number;
  occurredAt: number;
  reason: string;
}): EmailEventInput {
  return {
    ...input,
    type: "failed",
    dedupeKey: `failed:${input.assignmentId}:${input.stepNumber}:${input.reason}`,
    metadata: { reason: input.reason },
  };
}

export function replyEvent(input: {
  orgId: string;
  campaignId?: string;
  contactId?: string;
  mailboxId?: string;
  threadId: string;
  messageId?: string;
  occurredAt: number;
}): EmailEventInput {
  return {
    ...input,
    type: "reply",
    dedupeKey: `reply:${input.threadId}`,
  };
}

export function autoReplyEvent(input: {
  orgId: string;
  campaignId?: string;
  contactId?: string;
  mailboxId?: string;
  threadId: string;
  messageId?: string;
  occurredAt: number;
}): EmailEventInput {
  return {
    ...input,
    type: "auto_reply",
    dedupeKey: `auto_reply:${input.threadId}`,
  };
}

export function unsubscribeEvent(input: {
  orgId: string;
  campaignId?: string;
  contactId?: string;
  threadId?: string;
  messageId?: string;
  occurredAt: number;
}): EmailEventInput {
  return {
    ...input,
    type: "unsubscribe",
    dedupeKey: `unsubscribe:${input.contactId ?? "unknown"}:${input.campaignId ?? input.messageId ?? input.threadId ?? "unknown"}`,
  };
}

export function bounceEvent(input: {
  orgId: string;
  campaignId: string;
  contactId: string;
  messageId: string;
  email: string;
  bounceType: "hard" | "soft";
  occurredAt: number;
  dsnCode?: string;
}): EmailEventInput {
  return {
    ...input,
    type: input.bounceType === "hard" ? "bounce_hard" : "bounce_soft",
    dedupeKey: `bounce:${input.messageId}:${input.email}`,
    metadata: { email: input.email, dsnCode: input.dsnCode },
  };
}
