import { inngest } from "../client";
import { createWorkerDeps } from "../../src/server/worker";

/**
 * Reset daily sending counters for ALL mailboxes.
 * Triggered by cron at midnight UTC.
 *
 * Delegates counter updates to the provider-neutral reset handler.
 * which is a system-level operation with no user/org context.
 */
export const resetCounters = inngest.createFunction(
  { id: "reset-counters", triggers: [{ cron: "0 0 * * *" }] },
  async ({ step }) => {
    return await step.run("reset-mailbox-counters", async () => createWorkerDeps().resetCounters());
  }
);
