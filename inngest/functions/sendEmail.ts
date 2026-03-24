import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { inngest } from "../client";
import { withMailboxConnector } from "../lib/mailbox-worker";
import { parseSpintax, replaceVariables } from "../../convex/lib/spintax";
import { isWithinSendingWindow } from "../../convex/lib/timezone";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export const sendEmail = inngest.createFunction(
  {
    id: "send-email",
    retries: 3,
    triggers: [{ event: "campaign/send" }],
  },
  async ({ event, step }) => {
    const { campaignId, contactId, mailboxId, stepNumber } = event.data as {
      campaignId: Id<"campaigns">;
      contactId: Id<"contacts">;
      mailboxId: Id<"mailboxes">;
      stepNumber: number;
    };

    // ----------------------------------------------------------------
    // Step 1: Validate sending conditions
    // ----------------------------------------------------------------
    const conditionsOk = await step.run("validate-conditions", async () => {
      const [mailbox, contact, campaign] = await Promise.all([
        convex.query(api.queries.mailboxes.get, { id: mailboxId }),
        convex.query(api.queries.contacts.get, { id: contactId }),
        convex.query(api.queries.campaigns.get, { id: campaignId }),
      ]);

      if (!mailbox || !contact || !campaign) {
        console.warn("[sendEmail] Missing mailbox, contact, or campaign — skipping");
        return "missing-data";
      }

      // Check daily send limit
      if (mailbox.emailsSentToday >= mailbox.dailySendLimit) {
        console.warn(
          `[sendEmail] Daily limit reached for mailbox ${mailboxId} (${mailbox.emailsSentToday}/${mailbox.dailySendLimit}) — skipping`
        );
        return "daily-limit-reached";
      }

      // Check sending window (timezone)
      if (!isWithinSendingWindow(campaign, contact)) {
        console.warn(
          `[sendEmail] Outside sending window for contact ${contactId} — skipping`
        );
        return "outside-sending-window";
      }

      // Check doNotContact list (hard fail on error)
      const isBlocked = await (convex as any).query(
        ((api.queries as any).doNotContact as any)?.check ?? "queries/doNotContact:check", 
        { email: contact.email, orgId: mailbox.orgId }
      );
      if (isBlocked) {
        console.warn(`[sendEmail] Contact ${contact.email} is on doNotContact list — skipping`);
        return "do-not-contact";
      }

      return "ok";
    });

    if (conditionsOk !== "ok") {
      return { skipped: true, reason: conditionsOk };
    }

    // ----------------------------------------------------------------
    // Step 2 & 3: Decrypt, Connect, and Send
    // ----------------------------------------------------------------
    await withMailboxConnector(
      step,
      convex,
      mailboxId,
      async ({ mailbox, connector }) => {
        // Fetch campaign and contact for template rendering
        const [campaign, contact] = await Promise.all([
          convex.query(api.queries.campaigns.get, { id: campaignId }),
          convex.query(api.queries.contacts.get, { id: contactId }),
        ]);

        if (!campaign || !contact) {
          throw new Error("Campaign or contact not found during send step");
        }

        const rawSubject = campaign.steps[stepNumber]?.subject ?? "";
        const rawBody = campaign.steps[stepNumber]?.body ?? "";

        const customVars: Record<string, string> =
          contact.customVars && typeof contact.customVars === "object"
            ? (contact.customVars as Record<string, string>)
            : {};

        const subject = replaceVariables(parseSpintax(rawSubject), customVars);
        const htmlBody = replaceVariables(parseSpintax(rawBody), customVars);

        // Determine from address
        const mailboxAny = mailbox as Record<string, unknown>;
        const from =
          (mailboxAny.userEmail as string | undefined) ??
          (mailboxAny.username as string | undefined) ??
          "";

        // Generate unsubscribe token via Convex action
        const unsubscribeToken = await (convex as any).action(
          ((api as any).actions as any)?.unsubscribe?.generateToken ?? "actions/unsubscribe:generateToken",
          { contactId, campaignId }
        );

        // Construct unsubscribe URLs
        // Assumption: NEXT_PUBLIC_APP_URL is defined, fallback to localhost for dev
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const unsubscribeLink = `${appUrl}/api/unsubscribe?contactId=${contactId}&c=${campaignId}&t=${unsubscribeToken}`;
        const mailtoLink = `mailto:unsubscribe@samrian.com?subject=Unsubscribe%20${contactId}`;

        const listUnsubscribeHeader = `<${unsubscribeLink}>, <${mailtoLink}>`;
        const listUnsubscribePostHeader = "List-Unsubscribe=One-Click";

        // Ensure headers are correctly typed for connector.send
        const customHeaders: Record<string, string> = {
          "List-Unsubscribe": listUnsubscribeHeader,
          "List-Unsubscribe-Post": listUnsubscribePostHeader
        };

        const result = await connector.send({
          from,
          to: contact.email,
          subject,
          html: htmlBody,
          text: htmlBody.replace(/<[^>]+>/g, ""),
          headers: customHeaders,
        });

        // Record the sent email (idempotent via by_message_id index)
        await (convex as any).mutation(
          ((api.mutations as any).emailThreads as any)?.insertEmail ?? "mutations/emailThreads:insertEmail",
          {
            orgId: mailboxAny.orgId,
            campaignId,
            contactId,
            mailboxId,
            messageId: result.messageId,
            direction: "sent",
            from,
            to: [contact.email],
            subject,
            htmlBody,
            headers: {},
            sentAt: Date.now(),
          }
        );

        // Increment daily counter
        await convex.mutation((api.mutations.mailboxes as any).incrementSentToday ?? "mutations/mailboxes:incrementSentToday", {
          id: mailboxId,
        });
      }
    );

    return { sent: true };
  }
);

