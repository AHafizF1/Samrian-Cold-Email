import { inngest } from "../client";
import { createWorkerDeps } from "../../src/server/worker";
import { createInngestQueue } from "../lib/jobs";
import { DISPATCH_CRON } from "../../src/server/jobs/schedule";

export const dispatchCampaignSends = inngest.createFunction(
  { id: "dispatch-campaign-sends", triggers: [{ cron: DISPATCH_CRON }] },
  async ({ step }) => {
    return await createWorkerDeps(createInngestQueue(step)).dispatchDueSends();
  }
);
