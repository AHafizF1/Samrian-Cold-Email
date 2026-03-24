import { ConvexHttpClient } from "convex/browser";
import { NonRetriableError } from "inngest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { getConnector } from "../../lib/email-connectors/factory";
import { TokenRefreshError } from "../../convex/lib/errors";
import type { DecryptedCredentials } from "../../lib/email-connectors/types";

export type MailboxContext = {
  mailbox: any;
  decryptedCreds: DecryptedCredentials;
  connector: any;
};

/**
 * Shared helper to execute work within a mailbox connector lifecycle.
 * Handles decryption, connection, token refresh errors, and cleanup.
 */
export async function withMailboxConnector<T>(
  step: any,
  convex: ConvexHttpClient,
  mailboxId: Id<"mailboxes">,
  callback: (ctx: MailboxContext) => Promise<T>
): Promise<T> {
  const { mailbox, decryptedCreds } = await step.run(
    `get-mailbox-context-${mailboxId}`,
    async () => {
      const mb = await convex.query(api.queries.mailboxes.get, { id: mailboxId });
      if (!mb) throw new Error(`Mailbox ${mailboxId} not found`);

      // Decrypt credentials via internal action
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const creds = await (convex as any).action(
        // @ts-expect-error — internal actions are not in the generated API object
        api.actions?.encryption?.decryptMailboxCreds ?? "actions/encryption:decryptMailboxCreds",
        { mailboxId }
      ) as DecryptedCredentials;

      return { mailbox: mb, decryptedCreds: creds };
    }
  );

  const connector = await getConnector(mailbox, decryptedCreds);

  try {
    // Refresh OAuth2 token if needed (no-op for SMTP/IMAP)
    await connector.getFreshAccessToken();

    return await callback({ mailbox, decryptedCreds, connector });
  } catch (err) {
    if (err instanceof TokenRefreshError) {
      await step.run(`mark-mailbox-disconnected-${mailboxId}`, async () => {
        await convex.mutation(api.mutations.mailboxes.updateStatus, {
          id: mailboxId,
          status: "disconnected",
        });
      });
      throw new NonRetriableError(
        `Token refresh failed for ${mailboxId}: ${(err as Error).message}`,
        { cause: err }
      );
    }
    throw err;
  } finally {
    await connector.close();
  }
}
