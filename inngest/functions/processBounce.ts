import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { inngest } from "../client";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Bounce rate threshold — auto-pause campaign if exceeded
const BOUNCE_RATE_THRESHOLD = 0.05; // 5%

// ----------------------------------------------------------------
// Inline bounce classifier — no external library needed.
//
// Why not use email-bounce-parser?
// 1. Our events already carry the bounce type from the connector
// 2. DSN codes follow RFC 3463: 5.x.x = hard, 4.x.x = soft
// 3. The library is unmaintained (2+ yrs) and drags in native `re2`
// 4. 15 lines of focused logic beats 170KB of stale dependency
// ----------------------------------------------------------------

/** Hard-bounce keywords found in bounce message bodies */
const HARD_BOUNCE_PATTERNS = [
  "user unknown",
  "mailbox not found",
  "does not exist",
  "no such user",
  "invalid recipient",
  "address rejected",
  "account disabled",
  "account has been disabled",
  "recipient rejected",
  "550",   // SMTP permanent failure
  "551",
  "552",
  "553",
  "554",
] as const;

/** Soft-bounce keywords */
const SOFT_BOUNCE_PATTERNS = [
  "mailbox full",
  "over quota",
  "temporarily rejected",
  "try again later",
  "service unavailable",
  "connection timed out",
  "rate limit",
  "421",   // SMTP temporary failure
  "450",
  "451",
  "452",
] as const;

/**
 * Classify a bounce from a DSN status code and/or raw body text.
 * Returns "hard" or "soft". Defaults to "hard" (fail-safe: stop sending).
 */
function classifyBounce(opts: { dsnCode?: string; rawBody?: string }): "hard" | "soft" {
  const { dsnCode, rawBody } = opts;

  // 1. DSN code is the most reliable signal (RFC 3463)
  if (dsnCode) {
    if (dsnCode.startsWith("5")) return "hard";
    if (dsnCode.startsWith("4")) return "soft";
  }

  // 2. Fallback: keyword search in the raw bounce body
  if (rawBody) {
    const lower = rawBody.toLowerCase();

    // Check soft first (less destructive if wrong)
    for (const pattern of SOFT_BOUNCE_PATTERNS) {
      if (lower.includes(pattern)) return "soft";
    }
    for (const pattern of HARD_BOUNCE_PATTERNS) {
      if (lower.includes(pattern)) return "hard";
    }
  }

  // 3. Default to hard (fail-safe: prevents repeated sending to bad addresses)
  return "hard";
}

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
    retries: 3,
    triggers: [{ event: "email/bounce" }],
  },
  async ({ event, step }) => {
    const {
      messageId,
      bounceType: rawBounceType,
      email,
      orgId,
      campaignId,
      contactId,
      dsnCode,
      rawBody,
    } = event.data as {
      messageId: string;
      bounceType?: "soft" | "hard";
      email: string;
      orgId: string;
      campaignId: Id<"campaigns">;
      contactId: Id<"contacts">;
      dsnCode?: string;
      rawBody?: string;
    };

    // ----------------------------------------------------------------
    // Step 1: Determine bounce type
    // ----------------------------------------------------------------
    const bounceType = await step.run("classify-bounce", () => {
      // If the event already carries a classified bounce type, trust it
      if (rawBounceType === "soft" || rawBounceType === "hard") {
        return rawBounceType;
      }

      // Otherwise classify from DSN code / raw body
      return classifyBounce({ dsnCode, rawBody });
    });

    // ----------------------------------------------------------------
    // Step 2: Update contact.bounceStatus
    // ----------------------------------------------------------------
    await step.run("update-contact-bounce-status", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (convex as any).mutation(
        ((api.mutations as any).contacts as any)?.updateBounceStatus ??
          "mutations/contacts:updateBounceStatus",
        { id: contactId, bounceStatus: bounceType }
      );
    });

    // ----------------------------------------------------------------
    // Step 3: Update campaignContact.status → "bounced"
    // ----------------------------------------------------------------
    await step.run("update-campaign-contact-status", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const assignment = await (convex as any).query(
        ((api.queries as any).campaignContacts as any)?.getAssignment ??
          "queries/campaignContacts:getAssignment",
        { campaignId, contactId }
      );

      if (assignment && assignment.status !== "bounced") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (convex as any).mutation(
          ((api.mutations as any).campaignContacts as any)?.updateStatus ??
            "mutations/campaignContacts:updateStatus",
          { id: assignment._id, status: "bounced" }
        );
      }
    });

    // ----------------------------------------------------------------
    // Step 4: Add hard bounces to doNotContact
    // ----------------------------------------------------------------
    if (bounceType === "hard") {
      await step.run("add-to-do-not-contact", async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (convex as any).mutation(
          ((api.mutations as any).doNotContact as any)?.add ??
            "mutations/doNotContact:add",
          {
            email,
            reason: "bounced_hard",
            campaignId,
          }
        );
      });
    }

    // ----------------------------------------------------------------
    // Step 5: Check campaign bounce rate and auto-pause if > 5%
    // ----------------------------------------------------------------
    const shouldPause = await step.run("check-bounce-rate", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stats = await (convex as any).query(
        ((api.queries as any).campaignContacts as any)?.getCampaignStats ??
          "queries/campaignContacts:getCampaignStats",
        { campaignId }
      );

      if (!stats || stats.total === 0) return false;

      const bounceRate = stats.bounced / stats.total;
      return bounceRate > BOUNCE_RATE_THRESHOLD;
    });

    if (shouldPause) {
      await step.run("auto-pause-campaign", async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (convex as any).mutation(
          ((api.mutations as any).campaigns as any)?.updateStatus ??
            "mutations/campaigns:updateStatus",
          { id: campaignId, status: "paused" }
        );

        console.warn(
          `[processBounce] Campaign ${campaignId} auto-paused due to bounce rate exceeding ${BOUNCE_RATE_THRESHOLD * 100}%`
        );
      });
    }

    return {
      messageId,
      email,
      bounceType,
      campaignPaused: shouldPause,
    };
  }
);
