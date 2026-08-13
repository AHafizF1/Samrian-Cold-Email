import type { RawMessage } from "../jobs/types";

export type InboundKind = "reply" | "unsubscribe" | "bounce" | "auto-reply" | "ignored";

export type InboundClassification = {
  kind: InboundKind;
  matchMessageIds: string[];
  providerThreadId?: string;
};

export type InboundRejectReason =
  | "body-too-large"
  | "too-many-headers"
  | "header-too-large"
  | "too-many-parts"
  | "invalid-attachments"
  | "invalid-envelope";

export type InboundNormalization =
  { ok: true; message: RawMessage } | { ok: false; reason: InboundRejectReason };

const MAX_BODY_LENGTH = 256 * 1024;
const MAX_HEADERS = 100;
const MAX_HEADER_NAME_LENGTH = 100;
const MAX_HEADER_VALUE_LENGTH = 8 * 1024;
const MAX_MIME_PARTS = 100;
const MAX_RECIPIENTS = 100;
const MAX_ATTACHMENTS = 25;
const MAX_ENVELOPE_LENGTH = 998;
const UNSAFE_TEXT_CONTROLS =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g;

const AUTO_REPLY_HEADERS = [
  "x-autoreply",
  "x-autorespond",
  "x-auto-reply",
  "x-auto-response",
] as const;

const AUTO_REPLY_PHRASES = [
  "auto reply",
  "auto-reply",
  "automatic reply",
  "out of office",
  "out-of-office",
  "read receipt",
  "return receipt",
  "disposition notification",
] as const;

const UNSUBSCRIBE_PHRASES = [
  "unsubscribe",
  "opt out",
  "remove me",
  "take me off",
  "do not contact",
  "do not email",
  "stop emailing",
  "stop sending",
] as const;

const BOUNCE_PHRASES = [
  "delivery status notification",
  "delivery has failed",
  "undeliverable",
  "returned mail",
  "message could not be delivered",
  "no such user",
  "mailbox not found",
] as const;

export function normalizeMessageId(value?: string): string {
  return (value ?? "").trim().replace(/^<|>$/g, "").toLowerCase();
}

export function normalizeInboundMessage(message: RawMessage): InboundNormalization {
  const entries = Object.entries(message.headers);
  if (entries.length > MAX_HEADERS) return { ok: false, reason: "too-many-headers" };
  if ((message.partMimeTypes?.length ?? 0) > MAX_MIME_PARTS) {
    return { ok: false, reason: "too-many-parts" };
  }
  if (
    (message.attachments?.length ?? 0) > MAX_ATTACHMENTS ||
    message.attachments?.some(
      (attachment) =>
        !attachment.id ||
        attachment.id.length > MAX_ENVELOPE_LENGTH ||
        !attachment.filename ||
        attachment.filename.length > 255 ||
        !Number.isFinite(attachment.size) ||
        attachment.size < 0
    )
  ) {
    return { ok: false, reason: "invalid-attachments" };
  }
  if ((message.textBody?.length ?? 0) + (message.htmlBody?.length ?? 0) > MAX_BODY_LENGTH) {
    return { ok: false, reason: "body-too-large" };
  }
  if (
    !message.messageId ||
    message.messageId.length > MAX_ENVELOPE_LENGTH ||
    message.from.length > MAX_ENVELOPE_LENGTH ||
    message.subject.length > MAX_ENVELOPE_LENGTH ||
    message.to.length > MAX_RECIPIENTS ||
    message.to.some((address) => address.length > MAX_ENVELOPE_LENGTH) ||
    exceedsLength(message.providerMessageId) ||
    exceedsLength(message.threadId) ||
    exceedsLength(message.inReplyTo) ||
    message.references?.some(exceedsLength) ||
    (message.providerUrl?.length ?? 0) > 2048 ||
    !Number.isFinite(message.receivedAt)
  ) {
    return { ok: false, reason: "invalid-envelope" };
  }

  const headers: Record<string, string> = {};
  for (const [name, value] of entries) {
    if (
      name.length > MAX_HEADER_NAME_LENGTH ||
      value.length > MAX_HEADER_VALUE_LENGTH ||
      /[\r\n]/.test(name)
    ) {
      return { ok: false, reason: "header-too-large" };
    }
    headers[cleanText(name).toLowerCase()] = cleanText(value);
  }

  return {
    ok: true,
    message: {
      ...message,
      messageId: cleanText(message.messageId),
      providerMessageId: cleanOptional(message.providerMessageId),
      threadId: cleanOptional(message.threadId),
      from: cleanText(message.from),
      to: message.to.map(cleanText),
      subject: cleanText(message.subject),
      textBody: cleanOptional(message.textBody),
      htmlBody: cleanOptional(message.htmlBody),
      headers,
      inReplyTo: cleanOptional(message.inReplyTo),
      references: message.references?.slice(0, 50).map(cleanText),
      snippet: cleanOptional(message.snippet),
      mimeType: cleanOptional(message.mimeType),
      partMimeTypes: message.partMimeTypes?.map(cleanText),
      attachments: message.attachments?.map((attachment) => ({
        ...attachment,
        id: cleanText(attachment.id),
        filename: cleanText(attachment.filename),
        contentType: cleanOptional(attachment.contentType),
        contentId: cleanOptional(attachment.contentId),
      })),
      providerUrl: cleanOptional(message.providerUrl),
    },
  };
}

export function classifyInbound(message: RawMessage): InboundClassification {
  const matchMessageIds = collectMatchIds(message);
  const providerThreadId = message.threadId;

  if (isBounce(message)) return { kind: "bounce", matchMessageIds, providerThreadId };
  if (isAutoReply(message)) return { kind: "auto-reply", matchMessageIds, providerThreadId };
  if (isUnsubscribe(message)) return { kind: "unsubscribe", matchMessageIds, providerThreadId };
  if (matchMessageIds.length > 0 || providerThreadId) {
    return { kind: "reply", matchMessageIds, providerThreadId };
  }

  return { kind: "ignored", matchMessageIds, providerThreadId };
}

function collectMatchIds(message: RawMessage): string[] {
  const ids = [
    message.inReplyTo,
    getHeader(message.headers, "in-reply-to"),
    ...(message.references ?? []),
    ...splitReferences(getHeader(message.headers, "references")),
  ]
    .map(normalizeMessageId)
    .filter(Boolean);

  return [...new Set(ids)];
}

function isBounce(message: RawMessage): boolean {
  const contentType = getHeader(message.headers, "content-type")?.toLowerCase() ?? "";
  const from = message.from.toLowerCase();
  const body = bodyText(message);

  return (
    Boolean(getHeader(message.headers, "x-failed-recipients")) ||
    contentType.includes("message/delivery-status") ||
    contentType.includes("report-type=delivery-status") ||
    message.mimeType?.toLowerCase().includes("delivery-status") ||
    Boolean(
      message.partMimeTypes?.some((part) => part.toLowerCase().includes("delivery-status"))
    ) ||
    from.includes("mailer-daemon") ||
    from.includes("postmaster") ||
    BOUNCE_PHRASES.some((phrase) => body.includes(phrase)) ||
    /\b[45]\.\d+\.\d+\b/.test(body)
  );
}

function isAutoReply(message: RawMessage): boolean {
  const contentType = getHeader(message.headers, "content-type")?.toLowerCase() ?? "";
  const autoSubmitted = getHeader(message.headers, "auto-submitted")?.toLowerCase();
  const precedence = getHeader(message.headers, "precedence")?.toLowerCase();
  const body = bodyText(message);

  return (
    contentType.includes("report-type=disposition-notification") ||
    contentType.includes("message/disposition-notification") ||
    message.mimeType?.toLowerCase().includes("disposition-notification") ||
    Boolean(
      message.partMimeTypes?.some((part) => part.toLowerCase().includes("disposition-notification"))
    ) ||
    Boolean(autoSubmitted && autoSubmitted !== "no") ||
    Boolean(precedence && ["bulk", "auto_reply", "auto-reply"].includes(precedence)) ||
    AUTO_REPLY_HEADERS.some((header) => Boolean(getHeader(message.headers, header))) ||
    AUTO_REPLY_PHRASES.some((phrase) => body.includes(phrase))
  );
}

function isUnsubscribe(message: RawMessage): boolean {
  const body = bodyText(message);
  return UNSUBSCRIBE_PHRASES.some((phrase) => body.includes(phrase));
}

function bodyText(message: RawMessage): string {
  return [message.subject, message.textBody, message.htmlBody]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

function splitReferences(value?: string): string[] {
  return value?.match(/<[^>]+>|[^\s]+/g) ?? [];
}

function getHeader(headers: Record<string, string>, name: string): string | undefined {
  const target = name.toLowerCase();
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === target);
  return entry?.[1];
}

function cleanText(value: string): string {
  return value.replace(UNSAFE_TEXT_CONTROLS, "");
}

function cleanOptional(value?: string): string | undefined {
  return value === undefined ? undefined : cleanText(value);
}

function exceedsLength(value?: string): boolean {
  return (value?.length ?? 0) > MAX_ENVELOPE_LENGTH;
}
