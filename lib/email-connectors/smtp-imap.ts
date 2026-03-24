/**
 * SmtpImapConnector — provider-managed mailboxes (puzzle / mailpool)
 *
 * Send:  Nodemailer + SMTP, STARTTLS enforced on port 587
 * Poll:  ImapFlow, fetches UNSEEN messages, marks as SEEN, disconnects
 */

import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";
import type {
  MailboxConnector,
  MailboxRecord,
  SmtpImapCredentials,
  SendOptions,
  SendResult,
  RawMessage,
} from "./types";
import { MailboxConnectionError } from "../../convex/lib/errors";

export class SmtpImapConnector implements MailboxConnector {
  private imap: ImapFlow | null = null;

  constructor(
    private readonly mailbox: MailboxRecord,
    private readonly creds: SmtpImapCredentials
  ) {}

  // ── Send ────────────────────────────────────────────────────────────────────

  async send(message: SendOptions): Promise<SendResult> {
    const { smtpHost, smtpPort, username } = this.mailbox;

    if (!smtpHost || !smtpPort || !username) {
      throw new MailboxConnectionError(
        "Missing SMTP configuration",
        this.mailbox.provider
      );
    }

    // Enforce STARTTLS on port 587 — reject plain connections
    if (smtpPort !== 587) {
      throw new MailboxConnectionError(
        `SMTP port must be 587 (STARTTLS). Got: ${smtpPort}`,
        this.mailbox.provider
      );
    }

    const transport = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: false, // STARTTLS (upgrades after connect)
      requireTLS: true, // Reject if server doesn't support STARTTLS
      auth: { user: username, pass: this.creds.password },
      tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
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

  // ── Poll ────────────────────────────────────────────────────────────────────

  async pollNewMessages(): Promise<RawMessage[]> {
    const { imapHost, imapPort, username } = this.mailbox;

    if (!imapHost || !imapPort || !username) {
      throw new MailboxConnectionError(
        "Missing IMAP configuration",
        this.mailbox.provider
      );
    }

    const client = new ImapFlow({
      host: imapHost,
      port: imapPort,
      secure: false, // STARTTLS
      auth: { user: username, pass: this.creds.password },
      tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
      logger: false,
    });

    this.imap = client;
    const messages: RawMessage[] = [];

    try {
      await client.connect();

      const lock = await client.getMailboxLock("INBOX");
      try {
        // Fetch all UNSEEN messages
        for await (const msg of client.fetch("1:*", {
          uid: true,
          envelope: true,
          bodyStructure: true,
          source: true,
          flags: true,
        })) {
          // Skip already-seen messages
          if (msg.flags?.has("\\Seen")) continue;

          const raw = msg.source?.toString() ?? "";
          const parsed = parseRawEmail(raw, {
            envelope: msg.envelope,
            uid: msg.uid,
          });

          messages.push(parsed);

          // Mark as SEEN immediately after processing
          await client.messageFlagsAdd({ uid: msg.uid }, ["\\Seen"]);
        }
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
      this.imap = null;
    }

    return messages;
  }

  // ── Reply ───────────────────────────────────────────────────────────────────

  async replyToThread(threadId: string, html: string): Promise<void> {
    // threadId is the original Message-ID; build reply headers
    await this.send({
      from: this.mailbox.userEmail ?? this.mailbox.username ?? "",
      to: threadId, // caller should pass the recipient address, not the message-id
      subject: "", // caller should set subject via SendOptions — this overload is a convenience
      html,
      text: html.replace(/<[^>]+>/g, ""),
      inReplyTo: threadId,
      references: [threadId],
    });
  }

  // ── Token (no-op) ────────────────────────────────────────────────────────────

  async getFreshAccessToken(): Promise<string> {
    return "";
  }

  // ── Close ────────────────────────────────────────────────────────────────────

  async close(): Promise<void> {
    if (this.imap) {
      try {
        await this.imap.logout();
      } catch {
        // Already disconnected — ignore
      }
      this.imap = null;
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract a RawMessage from an ImapFlow fetch result.
 * Parses headers from the raw source string.
 */
function parseRawEmail(
  raw: string,
  msg: { envelope: any; uid: number }
): RawMessage {
  const headerSection = raw.split(/\r?\n\r?\n/)[0] ?? "";
  const headers: Record<string, string> = {};

  // Parse header lines (handle folded headers)
  const lines = headerSection.split(/\r?\n/);
  let currentKey = "";
  for (const line of lines) {
    if (/^\s/.test(line) && currentKey) {
      headers[currentKey] = (headers[currentKey] ?? "") + " " + line.trim();
    } else {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        currentKey = line.slice(0, colonIdx).toLowerCase();
        headers[currentKey] = line.slice(colonIdx + 1).trim();
      }
    }
  }

  const envelope = msg.envelope ?? {};
  const toAddresses: string[] = (envelope.to ?? []).map(
    (a: any) => a.address ?? ""
  );

  return {
    messageId: envelope.messageId ?? headers["message-id"] ?? `uid-${msg.uid}`,
    from: envelope.from?.[0]?.address ?? headers["from"] ?? "",
    to: toAddresses,
    subject: envelope.subject ?? headers["subject"] ?? "",
    textBody: undefined, // Full body parsing left to caller if needed
    htmlBody: undefined,
    headers,
    inReplyTo: headers["in-reply-to"],
    references: headers["references"]
      ? headers["references"].split(/\s+/).filter(Boolean)
      : undefined,
    receivedAt: envelope.date
      ? new Date(envelope.date).getTime()
      : Date.now(),
  };
}
