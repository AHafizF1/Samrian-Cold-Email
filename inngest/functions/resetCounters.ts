import { ConvexHttpClient } from "convex/browser";
import { inngest } from "../client";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Reset daily sending counters for ALL mailboxes.
 * Triggered by cron at midnight UTC.
 *
 * Uses internalMutation on the Convex side (mutations/mailboxes:resetDailyCounters)
 * which is a system-level operation with no user/org context.
 */
export const resetCounters = inngest.createFunction(
  { id: "reset-counters", triggers: [{ cron: "0 0 * * *" }] },
  async ({ step }) => {
    await step.run("reset-mailbox-counters", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (convex as any).mutation("mutations/mailboxes:resetDailyCounters");
    });

    return { success: true };
  }
);
