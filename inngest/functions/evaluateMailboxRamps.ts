import { createWorkerDeps } from "../../src/server/worker";
import { inngest } from "../client";

export const evaluateMailboxRamps = inngest.createFunction(
  {
    id: "evaluate-mailbox-ramps",
    triggers: [{ cron: "15 0 * * *" }, { event: "mailbox/ramp" }],
  },
  async ({ step }) =>
    step.run("evaluate-mailbox-ramps", () => createWorkerDeps().evaluateMailboxRamps())
);
