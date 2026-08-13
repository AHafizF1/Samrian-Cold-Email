/**
 * GmailApiConnector — Google Workspace mailboxes (OAuth2)
 *
 * Send:  Gmail API v1 users.messages.send (thread-aware), fallback to Nodemailer OAuth2
 * Poll:  Gmail API v1 users.messages.list with q:"is:unread"; caller marks read after DB work.
 */

import nodemailer from "nodemailer";
import { MailboxConnectionError } from "./errors";
import { buildMimeHeaders } from "./mime";
import { refreshAccessToken } from "./oauth";
import type {
  MailboxConnector,
  MailboxRecord,
  OAuthCredentials,
  SendOptions,
  SendResult,
  RawMessage,
  ConnectionTestResult,
  AttachmentDownload,
  AttachmentRef,
} from "./types";
import { deadlineSignal } from "../../src/server/network/deadline";
import { readJsonResponse } from "../../src/server/http/body";

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const MAX_MIME_DEPTH = 10;

export class GmailApiConnector implements MailboxConnector {
  /** Cached access token */
  private cachedToken: string | null = null;
  /** Expiry timestamp (ms) with 60s buffer already applied */
  private tokenExpiresAt: number = 0;

  constructor(
    private readonly mailbox: MailboxRecord,
    private readonly creds: OAuthCredentials
  ) {
    // Seed cache from stored token if still valid (with 60s buffer)
    if (creds.accessToken && creds.tokenExpiresAt) {
      const buffered = creds.tokenExpiresAt - 60_000;
      if (Date.now() < buffered) {
        this.cachedToken = creds.accessToken;
        this.tokenExpiresAt = buffered;
      }
    }
  }

  // ── Token ────────────────────────────────────────────────────────────────────

  async getFreshAccessToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.tokenExpiresAt) {
      return this.cachedToken;
    }

    const { accessToken, expiresIn } = await refreshAccessToken("google", this.creds.refreshToken);

    this.cachedToken = accessToken;
    // Apply 60s buffer so we refresh before actual expiry
    this.tokenExpiresAt = Date.now() + expiresIn * 1000 - 60_000;

    return accessToken;
  }

  // ── Send ────────────────────────────────────────────────────────────────────

  async send(message: SendOptions): Promise<SendResult> {
    const token = await this.getFreshAccessToken();

    const raw = buildRfc2822Message(message);
    const encoded = base64urlEncode(raw);

    const body: Record<string, unknown> = { raw: encoded };
    // Thread-aware: if replying, Gmail needs the threadId
    // We pass it via a custom field on SendOptions if available
    const opts = message as SendOptions & { gmailThreadId?: string };
    if (opts.gmailThreadId) {
      body.threadId = opts.gmailThreadId;
    }

    const response = await fetch(`${GMAIL_API_BASE}/messages/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: deadlineSignal(),
    });

    if (response.status === 403 || response.status === 404) {
      // Fallback to Nodemailer OAuth2
      return this.sendViaNodemailer(message, token);
    }

    if (!response.ok) {
      const err = await response.text();
      throw new MailboxConnectionError(
        `Gmail API send failed (${response.status}): ${err}`,
        "google"
      );
    }

    const data = await readJsonResponse<{ id: string; threadId: string }>(response, 64 * 1024);
    return {
      messageId: `<${data.id}@mail.gmail.com>`,
      accepted: [message.to],
      rejected: [],
    };
  }

  // ── Poll ────────────────────────────────────────────────────────────────────

  async pollNewMessages(): Promise<RawMessage[]> {
    const token = await this.getFreshAccessToken();

    // List unread messages
    const listResp = await fetch(`${GMAIL_API_BASE}/messages?q=is%3Aunread&maxResults=50`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: deadlineSignal(),
    });

    if (!listResp.ok) {
      throw new MailboxConnectionError(`Gmail API list failed (${listResp.status})`, "google");
    }

    const listData = await readJsonResponse<{
      messages?: Array<{ id: string; threadId: string }>;
    }>(listResp, 1024 * 1024);

    if (!listData.messages?.length) return [];

    const messages: RawMessage[] = [];

    for (const { id } of listData.messages) {
      const msgResp = await fetch(`${GMAIL_API_BASE}/messages/${id}?format=full`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: deadlineSignal(),
      });

      if (!msgResp.ok) continue;

      const gmailMsg = await readJsonResponse<GmailMessage>(msgResp, 2 * 1024 * 1024).catch(
        () => null
      );
      if (!gmailMsg) continue;
      const parsed = parseGmailMessage(gmailMsg);
      if (parsed) messages.push(parsed);
    }

    return messages;
  }

  async markMessageProcessed(message: RawMessage): Promise<void> {
    const id = message.providerMessageId;
    if (!id) return;

    const token = await this.getFreshAccessToken();
    await fetch(`${GMAIL_API_BASE}/messages/${id}/modify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
      signal: deadlineSignal(),
    });
  }

  async getAttachment(
    providerMessageId: string,
    attachmentId: string
  ): Promise<AttachmentDownload | null> {
    const token = await this.getFreshAccessToken();
    const response = await fetch(
      `${GMAIL_API_BASE}/messages/${encodeURIComponent(providerMessageId)}/attachments/${encodeURIComponent(attachmentId)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: deadlineSignal(),
      }
    );
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new MailboxConnectionError(
        `Gmail attachment fetch failed (${response.status})`,
        "google"
      );
    }
    const data = await readJsonResponse<{ data?: string; size?: number }>(
      response,
      6 * 1024 * 1024
    );
    if (!data.data) return null;
    const bytes = base64urlDecodeBytes(data.data);
    return {
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      }),
      size: data.size ?? bytes.byteLength,
    };
  }

  // ── Reply ───────────────────────────────────────────────────────────────────

  async replyToThread(threadId: string, html: string): Promise<void> {
    const token = await this.getFreshAccessToken();
    const from = this.mailbox.userEmail ?? "";

    const message: SendOptions & { gmailThreadId: string } = {
      from,
      to: from, // caller should override; this is a minimal fallback
      subject: "",
      html,
      text: html.replace(/<[^>]+>/g, ""),
      inReplyTo: threadId,
      references: [threadId],
      gmailThreadId: threadId,
    };

    const raw = buildRfc2822Message(message);
    const encoded = base64urlEncode(raw);

    const response = await fetch(`${GMAIL_API_BASE}/messages/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: encoded, threadId }),
      signal: deadlineSignal(),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new MailboxConnectionError(
        `Gmail API reply failed (${response.status}): ${err}`,
        "google"
      );
    }
  }

  // ── Test Connection ─────────────────────────────────────────────────────────

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const token = await this.getFreshAccessToken();
      const response = await fetch(`${GMAIL_API_BASE}/profile`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: deadlineSignal(),
      });

      if (response.ok) {
        return { ok: true };
      }

      const errorBody = await readJsonResponse<{ error?: { message?: string } }>(
        response,
        64 * 1024
      ).catch((): { error?: { message?: string } } => ({}));
      const errorMsg = errorBody?.error?.message ?? `HTTP ${response.status}`;

      // Detect revoked/expired tokens
      if (response.status === 401 || response.status === 403) {
        return {
          ok: false,
          error: errorMsg,
          requiresReconnect: true,
        };
      }

      return { ok: false, error: errorMsg };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const isAuthError = message.includes("invalid_grant") || message.includes("Token has been");
      return {
        ok: false,
        error: message,
        requiresReconnect: isAuthError,
      };
    }
  }

  // ── Close (no-op) ────────────────────────────────────────────────────────────

  async close(): Promise<void> {
    // Stateless HTTP — nothing to close
  }

  // ── Private: Nodemailer fallback ─────────────────────────────────────────────

  private async sendViaNodemailer(message: SendOptions, accessToken: string): Promise<SendResult> {
    const from = this.mailbox.userEmail ?? message.from;

    const transport = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: from,
        accessToken,
      },
    });

    const info = await transport.sendMail({
      from: message.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      headers: message.headers,
      ...(message.inReplyTo && { inReplyTo: message.inReplyTo }),
      ...(message.references?.length && {
        references: message.references.join(" "),
      }),
    });

    return {
      messageId: info.messageId,
      accepted: info.accepted as string[],
      rejected: info.rejected as string[],
    };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build an RFC 2822 email message string.
 */
function buildRfc2822Message(message: SendOptions): string {
  const lines = buildMimeHeaders(message);
  lines.push("", message.html);
  return lines.join("\r\n");
}

/**
 * Base64url encode a string (URL-safe, no padding).
 */
function base64urlEncode(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ── Gmail API types ───────────────────────────────────────────────────────────

interface GmailMessagePart {
  partId?: string;
  filename?: string;
  mimeType?: string;
  headers?: Array<{ name: string; value: string }>;
  body?: { attachmentId?: string; data?: string; size?: number };
  parts?: GmailMessagePart[];
}

interface GmailMessage {
  id: string;
  threadId: string;
  payload?: GmailMessagePart;
  internalDate?: string;
}

/**
 * Parse a Gmail API full message into a RawMessage.
 */
function parseGmailMessage(msg: GmailMessage): RawMessage | null {
  const payload = msg.payload;
  if (!payload) return null;

  const headers: Record<string, string> = {};
  for (const h of payload.headers ?? []) {
    headers[h.name.toLowerCase()] = h.value;
  }

  const messageId = headers["message-id"] ?? `gmail-${msg.id}`;
  const from = headers["from"] ?? "";
  const toRaw = headers["to"] ?? "";
  const to = toRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const subject = headers["subject"] ?? "";
  const inReplyTo = headers["in-reply-to"];
  const referencesRaw = headers["references"];
  const references = referencesRaw ? referencesRaw.split(/\s+/).filter(Boolean) : undefined;

  const receivedAt = msg.internalDate ? parseInt(msg.internalDate, 10) : Date.now();

  const { textBody, htmlBody } = extractBodies(payload);
  const attachments = collectAttachments(payload);

  return {
    messageId,
    providerMessageId: msg.id,
    threadId: msg.threadId,
    from,
    to,
    subject,
    textBody,
    htmlBody,
    headers,
    inReplyTo,
    references,
    mimeType: payload.mimeType,
    partMimeTypes: collectMimeTypes(payload),
    attachments,
    providerUrl: `https://mail.google.com/mail/u/0/#inbox/${encodeURIComponent(msg.threadId)}`,
    receivedAt,
  };
}

function collectMimeTypes(part: GmailMessagePart, depth = 0): string[] {
  return [
    ...(part.mimeType ? [part.mimeType] : []),
    ...(depth < MAX_MIME_DEPTH
      ? (part.parts ?? []).flatMap((child) => collectMimeTypes(child, depth + 1))
      : []),
  ];
}

function collectAttachments(part: GmailMessagePart, depth = 0): AttachmentRef[] {
  const disposition =
    part.headers?.find((header) => header.name.toLowerCase() === "content-disposition")?.value ??
    "";
  const current =
    part.body?.attachmentId && part.filename
      ? [
          {
            id: part.body.attachmentId,
            filename: part.filename,
            size: part.body.size ?? 0,
            contentType: part.mimeType,
            inline: disposition.toLowerCase().startsWith("inline"),
          },
        ]
      : [];
  return [
    ...current,
    ...(depth < MAX_MIME_DEPTH
      ? (part.parts ?? []).flatMap((child) => collectAttachments(child, depth + 1))
      : []),
  ];
}

/**
 * Recursively extract text and HTML bodies from a Gmail message part.
 */
function extractBodies(
  part: GmailMessagePart,
  depth = 0
): {
  textBody?: string;
  htmlBody?: string;
} {
  if (part.mimeType === "text/plain" && part.body?.data) {
    return { textBody: base64urlDecode(part.body.data) };
  }
  if (part.mimeType === "text/html" && part.body?.data) {
    return { htmlBody: base64urlDecode(part.body.data) };
  }

  let textBody: string | undefined;
  let htmlBody: string | undefined;

  if (depth >= MAX_MIME_DEPTH) return {};
  for (const child of part.parts ?? []) {
    const result = extractBodies(child, depth + 1);
    if (result.textBody) textBody = result.textBody;
    if (result.htmlBody) htmlBody = result.htmlBody;
  }

  return { textBody, htmlBody };
}

/**
 * Decode a base64url-encoded string.
 */
function base64urlDecode(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  return atob(padded);
}

function base64urlDecodeBytes(input: string): Uint8Array {
  const binary = base64urlDecode(input);
  return Uint8Array.from(binary, (value) => value.charCodeAt(0));
}
