import { inngest, inngestConcurrency } from "../client";
import { createWorkerDeps } from "../../src/server/worker";
import { createInngestQueue } from "../lib/jobs";
import type { MailboxHealthPayload } from "../../src/server/jobs/mailbox";

export const checkMailboxes = inngest.createFunction(
  {
    id: "check-mailboxes",
    concurrency: inngestConcurrency,
    triggers: [{ cron: "0 * * * *" }, { event: "mailbox/check/all" }],
  },
  async ({ step }) => {
    return createWorkerDeps(createInngestQueue(step)).dispatchMailboxChecks();
  }
);

export const checkSingleMailbox = inngest.createFunction(
  {
    id: "check-single-mailbox",
    triggers: [{ event: "mailbox/check" }],
    concurrency: inngestConcurrency,
  },
  async ({ event, step }) => {
    return await step.run("check-single-mailbox", () =>
      createWorkerDeps().checkMailboxHealth(event.data as MailboxHealthPayload)
    );
  }
);
