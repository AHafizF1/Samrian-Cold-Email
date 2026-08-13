/**
 * Core types and interfaces for the MailboxConnector abstraction layer.
 * All email provider implementations must conform to the MailboxConnector interface.
 */

// ============================================================
// Provider Types
// ============================================================

export type ProviderType = "smtp" | "puzzle" | "mailpool" | "google" | "microsoft";

// ============================================================
// Mailbox Record
// ============================================================

export type MailboxRecord = {
  id?: string;
  _id?: string;
  provider: ProviderType;
  smtpHost?: string | null;
  smtpPort?: number | null;
  imapHost?: string | null;
  imapPort?: number | null;
  username?: string | null;
  userEmail?: string | null;
};

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
  headers?: Record<string, string>;
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
}

export interface AttachmentRef {
  id: string;
  filename: string;
  size: number;
  contentType?: string;
  inline: boolean;
  contentId?: string;
}

export interface AttachmentDownload {
  body: ReadableStream<Uint8Array>;
  size: number;
}

// ============================================================
// Connection Test Result
// ============================================================

export interface ConnectionTestResult {
  /** Whether the connection was successful */
  ok: boolean;
  /** Error message if connection failed */
  error?: string;
  /** Whether the error indicates credentials need to be re-connected */
  requiresReconnect?: boolean;
}

// ============================================================
// MailboxConnector Interface
// ============================================================

export interface MailboxConnector {
  /** Send an email message */
  send(message: SendOptions): Promise<SendResult>;

  /** Poll for new/unread messages */
  pollNewMessages(): Promise<RawMessage[]>;

  /** Mark an inbound message processed after DB side effects succeed */
  markMessageProcessed?(message: RawMessage): Promise<void>;

  /** Fetch a provider-backed attachment. Unsupported providers omit this capability. */
  getAttachment?(
    providerMessageId: string,
    attachmentId: string
  ): Promise<AttachmentDownload | null>;

  /** Reply to an existing thread */
  replyToThread(threadId: string, html: string): Promise<void>;

  /**
   * Get a fresh access token (OAuth2 providers only).
   * SMTP/IMAP connectors return an empty string.
   */
  getFreshAccessToken(): Promise<string>;

  /**
   * Test the connection and credentials.
   * Returns { ok: true } if the connection is healthy,
   * or { ok: false, error, requiresReconnect } if it fails.
   */
  testConnection(): Promise<ConnectionTestResult>;

  /** Clean up connections and resources */
  close(): Promise<void>;
}
