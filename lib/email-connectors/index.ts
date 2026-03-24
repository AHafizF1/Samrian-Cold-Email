/**
 * Public API for the email-connectors module.
 * Re-exports all types, interfaces, and the connector factory.
 */

export type {
  ProviderType,
  MailboxRecord,
  DecryptedCredentials,
  SmtpImapCredentials,
  OAuthCredentials,
  SendOptions,
  SendResult,
  RawMessage,
  MailboxConnector,
} from "./types";

export { getConnector } from "./factory";
