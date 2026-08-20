import { inngest, inngestConcurrency } from "../client";
import { createWorkerDeps } from "../../src/server/worker";
import type { CampaignSendPayload } from "../../src/server/jobs/types";

/**
 * Optimized email sending worker for campaigns.
 * Handles rendering, connection, sending, and updating send state in a single flow.
 *
 * Runtime adapter: maps Inngest event data into the provider-neutral send handler.
 */
export const sendCampaignEmail = inngest.createFunction(
  {
    id: "send-campaign-email",
    concurrency: inngestConcurrency,
    retries: 3,
    triggers: [{ event: "campaign/send" }],
  },
  async ({ event, step }) => {
    return await step.run("send-campaign-email", () =>
      createWorkerDeps().sendCampaign(event.data as CampaignSendPayload)
    );
  }
);
