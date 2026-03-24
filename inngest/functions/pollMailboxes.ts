import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { inngest } from "../client";
import { withMailboxConnector } from "../lib/mailbox-worker";
import type { RawMessage } from "../../lib/email-connectors/types";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export const pollMailboxes = inngest.createFunction(
  { id: "poll-mailboxes", triggers: [{ cron: "*/5 * * * *" }] },
  async ({ step }) => {
    // ----------------------------------------------------------------
    // Step 1: Query all active mailboxes via Convex
    // ----------------------------------------------------------------
    const mailboxes = await step.run("get-active-mailboxes", async () => {
      return await convex.query(api.queries.mailboxes.listActive);
    });

    if (mailboxes.length === 0) {
      return { polled: 0 };
    }

    // ----------------------------------------------------------------
    // Step 2: Stagger mailbox polling to avoid overwhelming providers
    //         and stay within Inngest's concurrent step limits.
    // ----------------------------------------------------------------
    for (const [index, mailbox] of mailboxes.entries()) {
      if (index > 0) {
        await step.sleep(`stagger-${index}`, `${index * 2}s`);
      }

      await withMailboxConnector(
        step,
        convex,
        mailbox._id as Id<"mailboxes">,
        async ({ connector }) => {
          // Poll for new/unread messages
          const messages: RawMessage[] = await connector.pollNewMessages();

          // Process each message idempotently
          for (const message of messages) {
            await processIncomingMessage(message, mailbox._id as Id<"mailboxes">, mailbox.orgId);
          }

          // Update lastPolledAt timestamp
          await convex.mutation((api.mutations.mailboxes as any).updateLastPolled ?? "mutations/mailboxes:updateLastPolled", {
            id: mailbox._id as Id<"mailboxes">,
          });
        }
      );
    }

    return { polled: mailboxes.length };
  }
);

/**
 * Process a single incoming message:
 * - Match inReplyTo against a sent messageId to identify campaign replies
 * - If matched: insert into emailThreads + update campaignContact to "replied"
 * - ZERO-KNOWLEDGE POLICY: If no match: discard immediately.
 */
async function processIncomingMessage(
  message: RawMessage,
  mailboxId: Id<"mailboxes">,
  orgId: string
): Promise<void> {
  if (!message.inReplyTo || !message.messageId) {
    return;
  }

  // 1. Look up the SENT email this is a reply to (MUST match our org)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sentThread = await (convex as any).query(
    ((api.queries as any).emailThreads as any)?.getByMessageId ?? "queries/emailThreads:getByMessageId",
    { messageId: message.inReplyTo }
  );

  // ZERO-KNOWLEDGE: Only match sent emails originating from our system and org
  if (!sentThread || sentThread.direction !== "sent" || sentThread.orgId !== orgId) {
    return;
  }

  // 2. Insert the reply into emailThreads (Idempotent: insertEmail checks for duplicate messageId)
  await (convex as any).mutation(((api.mutations as any).emailThreads as any)?.insertEmail ?? "mutations/emailThreads:insertEmail", {
    orgId,
    campaignId: sentThread.campaignId,
    contactId: sentThread.contactId,
    mailboxId,
    messageId: message.messageId,
    inReplyTo: message.inReplyTo,
    references: message.references,
    direction: "received",
    from: message.from,
    to: message.to,
    subject: message.subject,
    textBody: message.textBody,
    htmlBody: message.htmlBody,
    headers: message.headers,
    receivedAt: message.receivedAt,
  });

  // 3. Update the campaignContact status to "replied"
  const assignment = await (convex as any).query(
    ((api.queries as any).campaignContacts as any)?.getAssignment ?? "queries/campaignContacts:getAssignment",
    {
      campaignId: sentThread.campaignId,
      contactId: sentThread.contactId,
    }
  );

  if (assignment && assignment.status !== "replied") {
    await (convex as any).mutation(
      ((api.mutations as any).campaignContacts as any)?.updateStatus ?? "mutations/campaignContacts:updateStatus",
      {
        id: assignment._id,
        status: "replied",
      }
    );
  }
}

