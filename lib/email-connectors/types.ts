/**
 * Core types and interfaces for the MailboxConnector abstraction layer.
 * All email provider implementations must conform to the MailboxConnector interface.
 */

import type { Doc } from "../../convex/_generated/dataModel";

// ============================================================
// Provider Types
// ============================================================

export type ProviderType = "puzzle" | "mailpool" | "google" | "microsoft";

// ============================================================
// Mailbox Record (mirrors convex/schema.ts mailboxes table)
// ============================================================

export type MailboxRecord = Doc<"mailboxes">;

// ============================================================
// Decrypted Credentials
// ============================================================

/** Decrypted SMTP/IMAP credentials for provider-managed mailboxes */
export interface SmtpImapCredentials {
  type: "smtp-imap";
  password: string;
}

/** Decrypted OAuth2 tokens for Google/Microsoft mailboxes */
export interface OAuthCredentials {
  type: "oauth2";
  refreshToken: string;
  accessToken?: string;
  tokenExpiresAt?: number;
}

export type DecryptedCredentials = SmtpImapCredentials | OAuthCredentials;

// ============================================================
// Send Options & Result
// ============================================================

export interface SendOptions {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  inReplyTo?: string;
  references?: string[];
}

export interface SendResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
}

// ============================================================
// Raw Message (from polling)
// ============================================================

export interface RawMessage {
  messageId: string;
  from: string;
  to: string[];
  subject: string;
  textBody?: string;
  htmlBody?: string;
  headers: Record<string, string>;
  inReplyTo?: string;
  references?: string[];
  receivedAt: number;
}

// ============================================================
// MailboxConnector Interface
// ============================================================

export interface MailboxConnector {
  /** Send an email message */
  send(message: SendOptions): Promise<SendResult>;

  /** Poll for new/unread messages */
  pollNewMessages(): Promise<RawMessage[]>;

  /** Reply to an existing thread */
  replyToThread(threadId: string, html: string): Promise<void>;

  /**
   * Get a fresh access token (OAuth2 providers only).
   * SMTP/IMAP connectors return an empty string.
   */
  getFreshAccessToken(): Promise<string>;

  /** Clean up connections and resources */
  close(): Promise<void>;
}
