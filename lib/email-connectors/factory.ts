/**
 * Connector factory — returns the appropriate MailboxConnector implementation
 * based on the mailbox provider field.
 *
 * Connector implementations (smtp-imap.ts, gmail.ts, microsoft.ts) are not yet
 * implemented. Each case throws a NotImplementedError until the corresponding
 * task is completed.
 */

import type { MailboxConnector, MailboxRecord, DecryptedCredentials } from "./types";
import { SmtpImapConnector } from "./smtp-imap";
import { GmailApiConnector } from "./gmail";
import { MicrosoftGraphConnector } from "./microsoft";

/**
 * Returns a MailboxConnector instance for the given mailbox and decrypted credentials.
 *
 * @param mailbox - The mailbox record from the database
 * @param decryptedCreds - Decrypted credentials/tokens for the mailbox
 * @returns A MailboxConnector ready to use
 */
export async function getConnector(
  mailbox: MailboxRecord,
  decryptedCreds: DecryptedCredentials
): Promise<MailboxConnector> {
  switch (mailbox.provider) {
    case "smtp":
    case "puzzle":
    case "mailpool": {
      if (decryptedCreds.type !== "smtp-imap") {
        throw new Error(`Provider "${mailbox.provider}" requires smtp-imap credentials`);
      }
      return new SmtpImapConnector(mailbox, decryptedCreds);
    }

    case "google": {
      if (decryptedCreds.type !== "oauth2") {
        throw new Error(`Provider "google" requires oauth2 credentials`);
      }
      return new GmailApiConnector(mailbox, decryptedCreds);
    }

    case "microsoft": {
      if (decryptedCreds.type !== "oauth2") {
        throw new Error(`Provider "microsoft" requires oauth2 credentials`);
      }
      return new MicrosoftGraphConnector(mailbox, decryptedCreds);
    }

    default: {
      // Exhaustive check — TypeScript will error if a new provider is added to the
      // schema without updating this factory.
      const _exhaustive: never = mailbox.provider;
      throw new Error(`Unknown provider: ${_exhaustive}`);
    }
  }
}
