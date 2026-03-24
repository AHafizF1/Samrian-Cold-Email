/**
 * GmailApiConnector — Google Workspace mailboxes (OAuth2)
 *
 * Send:  Gmail API v1 users.messages.send (thread-aware), fallback to Nodemailer OAuth2
 * Poll:  Gmail API v1 users.messages.list with q:"is:unread", mark as read after fetch
 */

import nodemailer from "nodemailer";
import { refreshAccessToken } from "../../convex/lib/oauth";
import { MailboxConnectionError, TokenRefreshError } from "../../convex/lib/errors";
import type {
  MailboxConnector,
  MailboxRecord,
  OAuthCredentials,
  SendOptions,
  SendResult,
  RawMessage,
} from "./types";

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

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

    const { accessToken, expiresIn } = await refreshAccessToken(
      "google",
      this.creds.refreshToken
    );

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

    const data = (await response.json()) as { id: string; threadId: string };
    const fromEmail = this.mailbox.userEmail ?? message.from;

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
    const listResp = await fetch(
      `${GMAIL_API_BASE}/messages?q=is%3Aunread&maxResults=50`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!listResp.ok) {
      throw new MailboxConnectionError(
        `Gmail API list failed (${listResp.status})`,
        "google"
      );
    }

    const listData = (await listResp.json()) as {
      messages?: Array<{ id: string; threadId: string }>;
    };

    if (!listData.messages?.length) return [];

    const messages: RawMessage[] = [];

    for (const { id } of listData.messages) {
      const msgResp = await fetch(
        `${GMAIL_API_BASE}/messages/${id}?format=full`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!msgResp.ok) continue;

      const gmailMsg = (await msgResp.json()) as GmailMessage;
      const parsed = parseGmailMessage(gmailMsg);
      if (parsed) messages.push(parsed);

      // Mark as read
      await fetch(`${GMAIL_API_BASE}/messages/${id}/modify`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
      });
    }

    return messages;
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
    });

    if (!response.ok) {
      const err = await response.text();
      throw new MailboxConnectionError(
        `Gmail API reply failed (${response.status}): ${err}`,
        "google"
      );
    }
  }

  // ── Close (no-op) ────────────────────────────────────────────────────────────

  async close(): Promise<void> {
    // Stateless HTTP — nothing to close
  }

  // ── Private: Nodemailer fallback ─────────────────────────────────────────────

  private async sendViaNodemailer(
    message: SendOptions,
    accessToken: string
  ): Promise<SendResult> {
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
  const lines: string[] = [
    `From: ${message.from}`,
    `To: ${message.to}`,
    `Subject: ${message.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
  ];

  if (message.inReplyTo) {
    lines.push(`In-Reply-To: ${message.inReplyTo}`);
  }
  if (message.references?.length) {
    lines.push(`References: ${message.references.join(" ")}`);
  }

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
  mimeType?: string;
  headers?: Array<{ name: string; value: string }>;
  body?: { data?: string; size?: number };
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
  const references = referencesRaw
    ? referencesRaw.split(/\s+/).filter(Boolean)
    : undefined;

  const receivedAt = msg.internalDate
    ? parseInt(msg.internalDate, 10)
    : Date.now();

  const { textBody, htmlBody } = extractBodies(payload);

  return {
    messageId,
    from,
    to,
    subject,
    textBody,
    htmlBody,
    headers,
    inReplyTo,
    references,
    receivedAt,
  };
}

/**
 * Recursively extract text and HTML bodies from a Gmail message part.
 */
function extractBodies(part: GmailMessagePart): {
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

  for (const child of part.parts ?? []) {
    const result = extractBodies(child);
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
