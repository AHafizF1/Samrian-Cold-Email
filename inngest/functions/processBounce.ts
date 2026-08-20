import { inngest, inngestConcurrency } from "../client";
import { createWorkerDeps } from "../../src/server/worker";
import type { BouncePayload } from "../../src/server/jobs/types";

/**
 * Process a bounce notification.
 * Triggered by event `email/bounce` with `{ messageId, bounceType, email, orgId, campaignId, contactId }`.
 *
 * Steps:
 * 1. Classify bounce type (soft vs hard) from DSN code, event data, or raw body
 * 2. Update contact.bounceStatus
 * 3. Update campaignContact.status to "bounced"
 * 4. Add hard bounces to doNotContact with reason "bounced_hard"
 * 5. Recalculate campaign bounce rate; auto-pause at > 5%
 */
export const processBounce = inngest.createFunction(
  {
    id: "process-bounce",
    concurrency: inngestConcurrency,
    retries: 3,
    triggers: [{ event: "email/bounce" }],
  },
  async ({ event, step }) => {
    const data = event.data as BouncePayload;
    const payload: BouncePayload = {
      messageId: data.messageId,
      orgId: data.orgId,
      campaignId: data.campaignId,
      contactId: data.contactId,
      bounceType: data.bounceType,
      dsnCode: data.dsnCode,
    };
    return await step.run("process-bounce", () => createWorkerDeps().processBounce(payload));
  }
);
