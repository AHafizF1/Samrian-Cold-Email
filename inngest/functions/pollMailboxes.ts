import { inngest, inngestConcurrency } from "../client";
import { createWorkerDeps } from "../../src/server/worker";
import { createInngestQueue } from "../lib/jobs";
import type { MailboxPollPayload } from "../../src/server/jobs/types";

export const pollMailboxes = inngest.createFunction(
  {
    id: "poll-mailboxes",
    concurrency: inngestConcurrency,
    triggers: [{ cron: "*/5 * * * *" }, { event: "mailbox/poll/all" }],
  },
  async ({ step }) => {
    return await createWorkerDeps(createInngestQueue(step)).dispatchMailboxPolls();
  }
);

export const pollSingleMailbox = inngest.createFunction(
  {
    id: "poll-single-mailbox",
    triggers: [{ event: "mailbox/poll/single" }],
    concurrency: inngestConcurrency,
  },
  async ({ event, step }) => {
    return await step.run("poll-single-mailbox", () =>
      createWorkerDeps().pollMailbox(event.data as MailboxPollPayload)
    );
  }
);
